"""
Glacier Data Processor
Cleans, merges, deduplicates raw records and produces enriched map-ready output.
"""

import csv
import json
import logging
import math
import os
from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict, List, Optional

from change_detector import ChangeDetector
from visualizer import GlacierVisualizer

logger = logging.getLogger("GlacierPipeline.Processor")


class GlacierProcessor:
    """Processes and enriches raw glacier records."""

    def __init__(self, db_manager=None):
        self.db = db_manager
        self.detector = ChangeDetector()
        self.visualizer = GlacierVisualizer()
        self.INDIA_BOUNDS = {"lat_min": 27.0, "lat_max": 36.5, "lon_min": 68.0, "lon_max": 98.0}
        self.model_output_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "output", "model")
        )
        self.model_profile = self._load_model_profile()
        self.per_glacier_predictions = self._load_per_glacier_predictions()

    REGION_COLORS = {
        "Karakoram": "#1E90FF",
        "Ladakh": "#4169E1",
        "Zanskar": "#6495ED",
        "Spiti": "#00CED1",
        "Lahaul": "#20B2AA",
        "Garhwal": "#3CB371",
        "Kumaon": "#2E8B57",
        "Sikkim Himalaya": "#FF6347",
        "Sikkim": "#FF4500",
        "Arunachal Pradesh": "#9370DB",
        "default": "#808080",
    }

    def process(self, raw_data: Dict[str, List[Dict]]) -> List[Dict]:
        """
        Full processing pipeline:
        1. Flatten all sources
        2. Validate & filter to India
        3. Deduplicate
        4. Enrich with map metadata
        5. Apply AI metadata from notebook artifacts
        6. Sort by area
        """
        all_records = []
        for source, records in raw_data.items():
            logger.info(f"Processing {len(records)} records from '{source}'")
            all_records.extend(records)

        logger.info(f"Total raw records: {len(all_records)}")

        validated = self._validate_and_filter(all_records)
        logger.info(f"After validation/filter: {len(validated)}")

        deduped = self._deduplicate(validated)
        logger.info(f"After deduplication: {len(deduped)}")

        enriched = [self._enrich(r) for r in deduped]

        # Deterministic model metadata from output/model artifacts.
        for g in enriched:
            self._classify_imagery(g)

        enriched.sort(key=lambda x: x.get("area_km2", 0), reverse=True)

        logger.info(f"Processing complete: {len(enriched)} glacier records")
        return enriched

    def _classify_imagery(self, glacier_record: Dict):
        """
        Attach AI inference metadata from model artifacts produced by
        output/model/glacier-detection-tiff-data.ipynb workflow.
        """
        profile = self.model_profile
        glacier_specific = self._get_glacier_prediction(glacier_record)
        confidence = glacier_specific.get("confidence", profile.get("confidence", 0.92))
        classes = glacier_specific.get("classes", profile.get("classes", {"Ice": 85, "Non-Ice": 15}))
        model_name = glacier_specific.get("model_name", profile.get("model_name", "Notebook-Derived Classifier"))

        glacier_record["ai_analysis"] = {
            "confidence": round(confidence, 4),
            "classes": classes,
            "model_name": model_name,
            "model_source_notebook": "output/model/glacier-detection-tiff-data.ipynb",
            "model_output_dir": self.model_output_dir,
            "prediction_source": glacier_specific.get("prediction_source", "global_model_metrics"),
            "last_image_date": datetime.now(timezone.utc).isoformat(),
        }

        # Keep a valid frontend image path and avoid dummy binary writes.
        glacier_record["satellite_image_url"] = "/images/output/india_glacier_01.jpg"

    def _load_model_profile(self) -> Dict:
        """
        Read precomputed model metrics from output/model for fast deterministic
        runtime behavior without rerunning the notebook.
        """
        profile = {
            "confidence": 0.92,
            "model_name": "Notebook-Derived Classifier",
            "classes": {"Ice": 85, "Non-Ice": 15},
        }

        try:
            summary_csv = os.path.join(self.model_output_dir, "final_model_summary.csv")
            binary_csv = os.path.join(self.model_output_dir, "binary_classification_results.csv")

            if os.path.exists(summary_csv):
                with open(summary_csv, "r", encoding="utf-8") as f:
                    rows = list(csv.DictReader(f))
                metric_map = {
                    (r.get("Metric") or "").strip(): (r.get("Value") or "").strip()
                    for r in rows
                }
                if metric_map.get("Accuracy"):
                    profile["confidence"] = float(metric_map["Accuracy"])

            if os.path.exists(binary_csv):
                with open(binary_csv, "r", encoding="utf-8") as f:
                    rows = list(csv.DictReader(f))
                if rows:
                    best = max(rows, key=lambda r: float(r.get("Accuracy") or 0))
                    profile["model_name"] = best.get("Model") or profile["model_name"]
                    recall = float(best.get("Recall") or best.get("Recall_Sensitivity") or 0.9)
                    specificity = float(best.get("Specificity") or 0.9)
                    profile["classes"] = {
                        "Ice": round(recall * 100, 2),
                        "Non-Ice": round(specificity * 100, 2),
                    }
                    profile["confidence"] = float(best.get("Accuracy") or profile["confidence"])
        except Exception as e:
            logger.warning(f"Failed to load model artifacts from {self.model_output_dir}: {e}")

        return profile

    def _load_per_glacier_predictions(self) -> Dict[str, Dict]:
        """
        Optional per-glacier predictions exported from the notebook.
        Supported filenames in output/model:
          - glacier_level_predictions.csv
          - per_glacier_predictions.csv
          - glacier_predictions.csv
        Expected columns (flexible):
          glacier_id or glacier_name/name, plus confidence/probability and optional class fields.
        """
        candidates = [
            "glacier_level_predictions.csv",
            "per_glacier_predictions.csv",
            "glacier_predictions.csv",
        ]
        predictions: Dict[str, Dict] = {}

        for candidate in candidates:
            path = os.path.join(self.model_output_dir, candidate)
            if not os.path.exists(path):
                continue
            try:
                with open(path, "r", encoding="utf-8") as f:
                    rows = list(csv.DictReader(f))
                for row in rows:
                    row = {
                        (k or "").strip().lstrip("\ufeff"): (v or "").strip()
                        for k, v in row.items()
                    }
                    gid = (row.get("glacier_id") or "").strip()
                    gname = (
                        row.get("glacier_name")
                        or row.get("name")
                        or row.get("glacier")
                        or ""
                    ).strip()

                    confidence_raw = (
                        row.get("confidence")
                        or row.get("probability")
                        or row.get("prob")
                        or row.get("score")
                        or row.get("ice_probability")
                        or ""
                    )
                    confidence = self._safe_float(confidence_raw)
                    if confidence is None:
                        confidence = self.model_profile.get("confidence", 0.92)
                    if confidence > 1:
                        confidence = confidence / 100.0

                    ice = self._safe_float(row.get("ice_percent") or row.get("ice") or row.get("snow_ice"))
                    non_ice = self._safe_float(row.get("non_ice_percent") or row.get("non_ice"))
                    classes = None
                    if ice is not None:
                        if ice <= 1:
                            ice = ice * 100.0
                        if non_ice is None:
                            non_ice = max(0.0, 100.0 - ice)
                        elif non_ice <= 1:
                            non_ice = non_ice * 100.0
                        classes = {"Ice": round(ice, 2), "Non-Ice": round(non_ice, 2)}

                    payload = {
                        "confidence": confidence,
                        "classes": classes or self.model_profile.get("classes", {"Ice": 85, "Non-Ice": 15}),
                        "model_name": row.get("model_name") or self.model_profile.get("model_name", "Notebook-Derived Classifier"),
                        "prediction_source": candidate,
                    }

                    if gid:
                        predictions[f"id:{gid.lower()}"] = payload
                    if gname:
                        predictions[f"name:{gname.lower()}"] = payload

                logger.info(f"Loaded per-glacier predictions from {candidate}: {len(rows)} rows")
                return predictions
            except Exception as e:
                logger.warning(f"Failed reading {candidate}: {e}")

        return predictions

    def _get_glacier_prediction(self, glacier_record: Dict) -> Dict:
        if not self.per_glacier_predictions:
            return {}
        gid = str(glacier_record.get("glacier_id", "")).strip().lower()
        name = str(glacier_record.get("name", "")).strip().lower()
        if gid and f"id:{gid}" in self.per_glacier_predictions:
            return self.per_glacier_predictions[f"id:{gid}"]
        if name and f"name:{name}" in self.per_glacier_predictions:
            return self.per_glacier_predictions[f"name:{name}"]
        return {}

    def _validate_and_filter(self, records: List[Dict]) -> List[Dict]:
        valid = []
        b = self.INDIA_BOUNDS
        for r in records:
            lat = self._safe_float(r.get("lat") or r.get("latitude") or r.get("cenlat"))
            lon = self._safe_float(r.get("lon") or r.get("longitude") or r.get("cenlon"))

            if lat is None or lon is None:
                continue
            if not (b["lat_min"] <= lat <= b["lat_max"]):
                continue
            if not (b["lon_min"] <= lon <= b["lon_max"]):
                continue

            r["lat"] = round(lat, 6)
            r["lon"] = round(lon, 6)
            valid.append(r)
        return valid

    def _deduplicate(self, records: List[Dict]) -> List[Dict]:
        """
        Remove near-duplicate glaciers: same name OR within 0.05 of each other.
        Priority: Curated > GLIMS > WGMS > RGI
        """
        priority = {"Curated_Inventory": 0, "GLIMS": 1, "WGMS": 2, "RGI": 3}
        records.sort(key=lambda r: priority.get(r.get("source", ""), 99))

        kept = []
        for r in records:
            is_dup = False
            for k in kept:
                if (
                    r.get("name")
                    and k.get("name")
                    and r["name"].lower().strip() == k["name"].lower().strip()
                ):
                    is_dup = True
                    break
                dist = self._haversine(r["lat"], r["lon"], k["lat"], k["lon"])
                if dist < 5.0:
                    is_dup = True
                    break
            if not is_dup:
                kept.append(r)
        return kept

    def _enrich(self, r: Dict) -> Dict:
        """Add map metadata, GeoJSON point, and display fields."""
        region = r.get("region") or self._infer_region(r["lat"], r["lon"])
        area = self._safe_float(r.get("area_km2")) or 0
        length = self._safe_float(r.get("length_km"))
        elev = self._safe_float(r.get("elevation_m"))

        marker_size = self._marker_size(area)
        color = self.REGION_COLORS.get(region, self.REGION_COLORS["default"])

        processed = {
            "glacier_id": r.get("glacier_id", ""),
            "name": r.get("name", "Unnamed Glacier"),
            "region": region,
            "state": r.get("state", self._infer_state(r["lat"], r["lon"])),
            "country": r.get("country", "India"),
            "lat": r["lat"],
            "lon": r["lon"],
            "area_km2": round(area, 2),
            "length_km": round(length, 2) if length else None,
            "elevation_m": int(elev) if elev else None,
            "type": r.get("type", "Valley"),
            "status": r.get("status", "Unknown"),
            "note": r.get("note"),
            "source": r.get("source", "Unknown"),
            "location": {
                "type": "Point",
                "coordinates": [r["lon"], r["lat"]],
            },
            "map": {
                "color": color,
                "marker_size": marker_size,
                "marker_symbol": "triangle",
                "popup_title": r.get("name", "Unnamed"),
                "popup_subtitle": f"{region} | {r.get('state', 'India')}",
                "popup_area": f"{area:.1f} km2" if area else "Unknown",
                "popup_length": f"{length:.1f} km" if length else "N/A",
                "popup_elev": f"{int(elev)} m" if elev else "N/A",
            },
            "survey_date": r.get("survey_date"),
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }

        if self.db:
            history = self.db.get_glacier_history(processed["glacier_id"])
            change_stats = self.detector.detect_changes(processed, history)
            processed["change_analysis"] = change_stats

            if change_stats.get("risk_level") == "High":
                processed["map"]["color"] = "#FF0000"
            elif change_stats.get("risk_level") == "Critical":
                processed["map"]["color"] = "#8B0000"

            if history and len(history) >= 2:
                graph_bytes = self.visualizer.generate_history_graph(processed["name"], history)
                if graph_bytes:
                    filename = f"graph_{processed['glacier_id']}.png"
                    self.db.save_file(
                        filename,
                        graph_bytes,
                        metadata={"type": "trend_graph", "glacier_id": processed["glacier_id"]},
                    )
                    processed["trend_graph_url"] = f"/files/{filename}"

        return processed

    def generate_output_json(self, processed: List[Dict], output_dir: str = "output") -> Dict[str, str]:
        """Generate multiple JSON output files."""
        os.makedirs(output_dir, exist_ok=True)
        now = datetime.now(timezone.utc)
        ts = now.strftime("%Y%m%d_%H%M%S")
        files = {}

        full_path = f"{output_dir}/glaciers_india_{ts}.json"
        with open(full_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "generated_at": now.isoformat(),
                    "total_count": len(processed),
                    "bounds": self.INDIA_BOUNDS,
                    "glaciers": processed,
                },
                f,
                indent=2,
                default=str,
            )
        files["full_dataset"] = full_path

        geojson = {
            "type": "FeatureCollection",
            "name": "India Glaciers",
            "generated_at": now.isoformat(),
            "features": [
                {
                    "type": "Feature",
                    "id": g["glacier_id"],
                    "geometry": {"type": "Point", "coordinates": [g["lon"], g["lat"]]},
                    "properties": {k: v for k, v in g.items() if k not in ("location",)},
                }
                for g in processed
            ],
        }
        geo_path = f"{output_dir}/glaciers_india_geojson_{ts}.json"
        with open(geo_path, "w", encoding="utf-8") as f:
            json.dump(geojson, f, indent=2, default=str)
        files["geojson"] = geo_path

        map_points = [
            {
                "id": g["glacier_id"],
                "name": g["name"],
                "lat": g["lat"],
                "lon": g["lon"],
                "region": g["region"],
                "state": g["state"],
                "area": g["area_km2"],
                "length": g.get("length_km"),
                "elev": g.get("elevation_m"),
                "status": g["status"],
                "color": g["map"]["color"],
                "size": g["map"]["marker_size"],
                "note": g.get("note"),
            }
            for g in processed
        ]
        map_path = f"{output_dir}/glacier_map_points_{ts}.json"
        with open(map_path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "generated_at": now.isoformat(),
                    "count": len(map_points),
                    "points": map_points,
                },
                f,
                indent=2,
                default=str,
            )
        files["map_points"] = map_path

        stats = self._compute_stats(processed)
        stats_path = f"{output_dir}/glacier_stats_{ts}.json"
        with open(stats_path, "w", encoding="utf-8") as f:
            json.dump({"generated_at": now.isoformat(), **stats}, f, indent=2, default=str)
        files["stats"] = stats_path

        for key, path in files.items():
            latest = f"{output_dir}/latest_{key}.json"
            import shutil

            shutil.copy2(path, latest)

        logger.info(f"Generated {len(files)} JSON output files in '{output_dir}/'")
        return files

    def _compute_stats(self, records: List[Dict]) -> Dict:
        total_area = sum(r.get("area_km2", 0) for r in records)
        by_region = defaultdict(lambda: {"count": 0, "area": 0.0})
        by_state = defaultdict(lambda: {"count": 0, "area": 0.0})
        by_source = defaultdict(int)

        for r in records:
            by_region[r["region"]]["count"] += 1
            by_region[r["region"]]["area"] += r.get("area_km2", 0)
            by_state[r["state"]]["count"] += 1
            by_state[r["state"]]["area"] += r.get("area_km2", 0)
            by_source[r["source"]] += 1

        return {
            "summary": {
                "total_glaciers": len(records),
                "total_area_km2": round(total_area, 2),
                "average_area_km2": round(total_area / len(records), 2) if records else 0,
                "largest_glacier": max(records, key=lambda x: x.get("area_km2", 0))["name"] if records else None,
                "states_covered": len(by_state),
                "regions_covered": len(by_region),
            },
            "by_region": {k: {**v, "area": round(v["area"], 2)} for k, v in by_region.items()},
            "by_state": {k: {**v, "area": round(v["area"], 2)} for k, v in by_state.items()},
            "by_source": dict(by_source),
        }

    def _safe_float(self, v) -> Optional[float]:
        try:
            return float(v) if v is not None else None
        except (ValueError, TypeError):
            return None

    def _marker_size(self, area: float) -> int:
        if area > 500:
            return 20
        if area > 100:
            return 15
        if area > 30:
            return 10
        if area > 5:
            return 7
        return 5

    def _haversine(self, lat1, lon1, lat2, lon2) -> float:
        r = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def _infer_region(self, lat: float, lon: float) -> str:
        if lon < 76.5 and lat > 33.5:
            return "Karakoram"
        if lon < 78.0 and lat > 32.5:
            return "Ladakh"
        if lon < 77.5 and lat > 31.5:
            return "Zanskar"
        if 77.0 <= lon <= 78.5 and 31.5 <= lat <= 33.0:
            return "Spiti"
        if 76.5 <= lon <= 77.5 and 32.0 <= lat <= 32.8:
            return "Lahaul"
        if 78.0 <= lon <= 80.5 and 30.0 <= lat <= 32.0:
            return "Garhwal"
        if 79.5 <= lon <= 81.0 and 29.5 <= lat <= 31.0:
            return "Kumaon"
        if 87.5 <= lon <= 89.0 and 27.0 <= lat <= 29.0:
            return "Sikkim Himalaya"
        if lon >= 90.0:
            return "Arunachal Pradesh"
        return "Himalayan"

    def _infer_state(self, lat: float, lon: float) -> str:
        if lon < 78.5 and lat > 32.5:
            return "Ladakh"
        if 76.5 <= lon <= 78.5 and 31.5 <= lat <= 32.5:
            return "Himachal Pradesh"
        if 78.0 <= lon <= 81.0 and 29.5 <= lat <= 31.5:
            return "Uttarakhand"
        if 87.5 <= lon <= 89.0 and 27.0 <= lat <= 28.5:
            return "Sikkim"
        if lon >= 90.0:
            return "Arunachal Pradesh"
        return "India"
