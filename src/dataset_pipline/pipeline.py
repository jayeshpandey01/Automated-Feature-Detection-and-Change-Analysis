"""
╔══════════════════════════════════════════════════════════════╗
║         INDIA GLACIER MONITORING PIPELINE                   ║
║  Live Data Collection → MongoDB → JSON Output → Map Ready   ║
╚══════════════════════════════════════════════════════════════╝

Flow:
  1. Check MongoDB for existing data (fresh enough?)
  2. If stale/missing → download from sources
  3. Store raw data in MongoDB
  4. Process & enrich glacier records
  5. Delete old processed data
  6. Store new processed data in MongoDB
  7. Export JSON output files
  8. Log everything
  9. Print summary
"""

import json
import logging
import os
import sys
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

# ── Local modules ──────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))
from config import (
    MONGODB_URI, DB_NAME, OUTPUT_DIR, LOG_DIR, RAW_DATA_DIR, PROCESSED_DATA_DIR
)
from db_manager import DatabaseManager
from downloader import GlacierDownloader
from processor import GlacierProcessor


# ──────────────────────────────────────────────────
# LOGGING SETUP
# ──────────────────────────────────────────────────
def setup_logging(log_dir: str = "logs") -> logging.Logger:
    os.makedirs(log_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = f"{log_dir}/pipeline_{ts}.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_file, encoding="utf-8")
        ]
    )
    return logging.getLogger("GlacierPipeline"), log_file


# ──────────────────────────────────────────────────
# PIPELINE CLASS
# ──────────────────────────────────────────────────
class GlacierPipeline:
    """
    Orchestrates the full glacier data pipeline.
    """

    DATA_FRESHNESS_HOURS = 24  # Re-download if data older than this

    def __init__(self):
        self.logger, self.log_file = setup_logging(LOG_DIR)
        self.db = DatabaseManager(MONGODB_URI, DB_NAME)
        self.downloader = GlacierDownloader(RAW_DATA_DIR)
        self.processor = GlacierProcessor(db_manager=self.db)
        self.run_id = datetime.now(timezone.utc).strftime("RUN_%Y%m%d_%H%M%S")

    # ──────────────────────────────────────────────
    # MAIN RUN
    # ──────────────────────────────────────────────
    def run(self, force_download: bool = False) -> Dict:
        """
        Execute the full pipeline. Returns summary dict.
        """
        self.logger.info("=" * 62)
        self.logger.info(f"  🏔  GLACIER PIPELINE STARTED  [{self.run_id}]")
        self.logger.info("=" * 62)

        result = {
            "run_id":           self.run_id,
            "started_at":       datetime.now(timezone.utc).isoformat(),
            "steps":            {},
            "output_files":     {},
            "glacier_count":    0,
            "status":           "running"
        }

        try:
            # ── STEP 1: Check existing data ────────────────
            self.logger.info("\n📋 STEP 1: Checking existing data in MongoDB...")
            existing_count = self.db.get_record_count("glaciers_raw")
            is_fresh = self.db.is_data_fresh("Curated_Inventory", self.DATA_FRESHNESS_HOURS)

            result["steps"]["check_db"] = {
                "existing_records": existing_count,
                "data_is_fresh": is_fresh,
                "force_download": force_download
            }

            if existing_count > 0 and is_fresh and not force_download:
                self.logger.info(
                    f"✅ Found {existing_count} fresh records in DB. Skipping download."
                )
                raw_data = self._load_raw_from_db()
            else:
                self.logger.info("⬇️  Data is stale or missing. Starting download...")

                # ── STEP 2: Download ───────────────────────
                raw_data = self._step_download()
                result["steps"]["download"] = {
                    "sources": list(raw_data.keys()),
                    "total_raw": sum(len(v) for v in raw_data.values())
                }

                # ── STEP 3: Store raw in MongoDB ───────────
                stored = self._step_store_raw(raw_data)
                result["steps"]["store_raw"] = stored

            # ── STEP 4: Process ────────────────────────────
            self.logger.info("\n⚙️  STEP 4: Processing glacier data...")
            processed = self.processor.process(raw_data)
            result["glacier_count"] = len(processed)
            result["steps"]["process"] = {"processed_count": len(processed)}

            # ── STEP 5: Delete old processed data ──────────
            self.logger.info("\n🗑  STEP 5: Removing old processed data...")
            deleted = self.db.delete_old_processed_data()
            result["steps"]["cleanup"] = {"deleted_processed": deleted}

            # ── STEP 6: Store new processed data ──────────
            self.logger.info("\n💾 STEP 6: Storing new processed data in MongoDB...")
            stored_proc = self.db.upsert_processed_glaciers(processed)
            result["steps"]["store_processed"] = {"upserted": stored_proc}

            # ── STEP 7: Generate JSON output files ─────────
            self.logger.info("\n📁 STEP 7: Generating JSON output files...")
            output_files = self.processor.generate_output_json(processed, OUTPUT_DIR)
            result["output_files"] = output_files

            # ── STEP 8: Clean up old raw data ──────────────
            self.logger.info("\n🧹 STEP 8: Cleaning up old raw data in DB...")
            for source in raw_data.keys():
                self.db.delete_old_raw_data(source, keep_latest_n=1)

            # ── STEP 9: Log completion ─────────────────────
            result["status"] = "success"
            result["finished_at"] = datetime.now(timezone.utc).isoformat()
            self.db.log_event("pipeline_complete", self.run_id, {
                "glacier_count": len(processed),
                "output_files": list(output_files.keys())
            })

            self._print_summary(processed, output_files, result)

        except Exception as e:
            self.logger.error(f"❌ Pipeline failed: {e}", exc_info=True)
            result["status"] = "failed"
            result["error"] = str(e)
            self.db.log_event("pipeline_error", self.run_id, {"error": str(e)}, status="error")

        finally:
            # Write run log JSON
            self._write_run_log(result)
            self.db.close()

        return result

    # ──────────────────────────────────────────────
    # STEP IMPLEMENTATIONS
    # ──────────────────────────────────────────────
    def _step_download(self) -> Dict[str, List[Dict]]:
        """Download from all sources, log each."""
        raw_data = {}
        sources = [
            "Curated_Inventory",
            "GLIMS_API",
            "WGMS_India",
            "RGI_Catalog",
        ]
        for source in sources:
            try:
                records = self.downloader.download_source(source)
                if records:
                    raw_data[source] = records
                    self.db.log_event("download", source, {"count": len(records)})
                    self.logger.info(f"  ✔ {source}: {len(records)} records")
                else:
                    self.logger.warning(f"  ⚠ {source}: 0 records")
            except Exception as e:
                self.logger.warning(f"  ✘ {source} failed: {e}")
                self.db.log_event("download", source, {"error": str(e)}, status="error")

        if not raw_data:
            raise RuntimeError("All download sources failed!")
        return raw_data

    def _step_store_raw(self, raw_data: Dict[str, List[Dict]]) -> Dict:
        stored = {}
        for source, records in raw_data.items():
            n = self.db.upsert_raw_glaciers(records, source)
            self.db.log_event("store_raw", source, {"count": n})
            stored[source] = n
        return stored

    def _load_raw_from_db(self) -> Dict[str, List[Dict]]:
        """Load existing raw records from DB when skipping download."""
        if not self.db.is_connected():
            self.logger.warning("DB not connected; triggering fresh download instead.")
            return self._step_download()
        try:
            cursor = self.db.db["glaciers_raw"].find({}, {"_id": 0})
            all_records = list(cursor)
            grouped: Dict[str, List[Dict]] = {}
            for r in all_records:
                s = r.get("source", "Unknown")
                grouped.setdefault(s, []).append(r)
            self.logger.info(
                f"📥 Loaded {len(all_records)} records from DB "
                f"({len(grouped)} sources)"
            )
            return grouped
        except Exception as e:
            self.logger.warning(f"DB load failed ({e}); triggering fresh download.")
            return self._step_download()

    # ──────────────────────────────────────────────
    # OUTPUT / LOGGING
    # ──────────────────────────────────────────────
    def _print_summary(self, processed: List[Dict], output_files: Dict, result: Dict):
        self.logger.info("\n" + "=" * 62)
        self.logger.info("  🏔  PIPELINE SUMMARY")
        self.logger.info("=" * 62)
        self.logger.info(f"  Run ID        : {self.run_id}")
        self.logger.info(f"  Status        : ✅ {result['status'].upper()}")
        self.logger.info(f"  Total glaciers: {len(processed)}")

        from collections import Counter
        regions = Counter(g["region"] for g in processed)
        states  = Counter(g["state"]  for g in processed)

        self.logger.info("\n  📍 By Region:")
        for region, count in sorted(regions.items(), key=lambda x: -x[1]):
            self.logger.info(f"      {region:<25} {count:>3} glaciers")

        self.logger.info("\n  🗺  By State:")
        for state, count in sorted(states.items(), key=lambda x: -x[1]):
            self.logger.info(f"      {state:<25} {count:>3} glaciers")

        total_area = sum(g.get("area_km2", 0) for g in processed)
        largest = max(processed, key=lambda x: x.get("area_km2", 0), default={})
        self.logger.info(f"\n  📐 Total glacier area : {total_area:,.1f} km²")
        self.logger.info(f"  🥇 Largest glacier   : {largest.get('name','?')} ({largest.get('area_km2', 0):,.0f} km²)")

        self.logger.info("\n  📁 Output Files:")
        for key, path in output_files.items():
            size_kb = os.path.getsize(path) / 1024 if os.path.exists(path) else 0
            self.logger.info(f"      [{key}] {path}  ({size_kb:.1f} KB)")

        self.logger.info("\n  📝 Log file: " + self.log_file)
        self.logger.info("=" * 62 + "\n")

    def _write_run_log(self, result: Dict):
        os.makedirs(LOG_DIR, exist_ok=True)
        log_path = f"{LOG_DIR}/run_{self.run_id}.json"
        with open(log_path, "w") as f:
            json.dump(result, f, indent=2, default=str)
        self.logger.info(f"📝 Run log saved: {log_path}")


# ──────────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────────
def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="India Glacier Monitoring Pipeline"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Force re-download even if data is fresh"
    )
    args = parser.parse_args()

    pipeline = GlacierPipeline()
    result = pipeline.run(force_download=args.force)

    sys.exit(0 if result.get("status") == "success" else 1)


if __name__ == "__main__":
    main()
