"""
MongoDB Database Manager for Glacier Pipeline
Handles all DB operations: connect, check, store, update, delete, log
"""

import logging
import hashlib
import json
import gridfs
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

logger = logging.getLogger("GlacierPipeline.DB")


class DatabaseManager:
    """Manages all MongoDB interactions for the glacier pipeline."""

    def __init__(self, uri: str, db_name: str):
        self.uri = uri
        self.db_name = db_name
        self.client = None
        self.db = None
        self.fs = None
        self._connect()

    def _connect(self):
        """Establish MongoDB connection."""
        try:
            from pymongo import MongoClient
            from pymongo.errors import ConnectionFailure

            self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            self.client.admin.command("ping")  # Test connection
            self.db = self.client[self.db_name]
            self.fs = gridfs.GridFS(self.db)
            logger.info(f"✅ Connected to MongoDB: {self.db_name}")
            self._create_indexes()
        except Exception as e:
            logger.warning(f"⚠️  MongoDB not available ({e}).")
            logger.info("👉 TIP: If you are on Windows, ensure the 'MongoDB' service is started in 'services.msc'.")
            logger.info("👉 Using in-memory fallback for now.")
            self.client = None
            self.db = None
            self.fs = None

    def save_file(self, filename: str, content: bytes, metadata: Dict = None) -> str:
        """Store a file in GridFS and return its ID."""
        if not self.fs:
            return ""
        try:
            # Delete old version if exists
            old = self.db.fs.files.find_one({"filename": filename})
            if old:
                self.fs.delete(old["_id"])
                
            file_id = self.fs.put(content, filename=filename, metadata=metadata or {})
            return str(file_id)
        except Exception as e:
            logger.error(f"Failed to save file {filename}: {e}")
            return ""

    def get_file(self, filename: str) -> Optional[bytes]:
        """Retrieve a file from GridFS."""
        if not self.fs:
            return None
        try:
            f = self.fs.get_last_version(filename=filename)
            return f.read()
        except Exception:
            return None

    def _create_indexes(self):
        """Create indexes for performance."""
        if self.db is None:
            return
        try:
            self.db["glaciers_raw"].create_index([("glacier_id", 1)], unique=True)
            self.db["glaciers_raw"].create_index([("source", 1)])
            self.db["glaciers_raw"].create_index([("downloaded_at", -1)])
            self.db["glaciers_processed"].create_index([("glacier_id", 1)])
            self.db["glacier_history"].create_index([("glacier_id", 1), ("timestamp", -1)])
            self.db["glaciers_processed"].create_index([
                ("location.coordinates", "2dsphere")
            ])
            logger.info("📑 MongoDB indexes created/verified")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")

    def is_connected(self) -> bool:
        return self.client is not None and self.db is not None

    # ─────────────────────────────────────────────
    # VERSION / DOWNLOAD CHECK
    # ─────────────────────────────────────────────
    def get_latest_version(self, source: str) -> Optional[Dict]:
        """Return the latest download record for a source."""
        if not self.is_connected():
            return None
        try:
            return self.db["pipeline_logs"].find_one(
                {"event": "download", "source": source},
                sort=[("timestamp", -1)]
            )
        except Exception as e:
            logger.error(f"Version check failed: {e}")
            return None

    def is_data_fresh(self, source: str, max_age_hours: int = 24) -> bool:
        """Check if downloaded data is recent enough to skip re-download."""
        record = self.get_latest_version(source)
        if not record:
            return False
        last_dl = record.get("timestamp")
        if not last_dl:
            return False
        # MongoDB may return naive datetimes — make timezone-aware
        if hasattr(last_dl, 'tzinfo') and last_dl.tzinfo is None:
            last_dl = last_dl.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - last_dl).total_seconds() / 3600
        logger.info(f"Data age for '{source}': {age:.1f}h (max: {max_age_hours}h)")
        return age < max_age_hours

    def get_record_count(self, collection: str) -> int:
        """Return number of documents in a collection."""
        if not self.is_connected():
            return 0
        try:
            return self.db[collection].count_documents({})
        except Exception:
            return 0

    # ─────────────────────────────────────────────
    # STORE / UPSERT
    # ─────────────────────────────────────────────
    def upsert_raw_glaciers(self, records: List[Dict], source: str) -> int:
        """Upsert raw glacier records. Returns number of upserted docs."""
        if not self.is_connected():
            logger.warning("DB not connected — raw records not persisted.")
            return 0
        from pymongo import UpdateOne
        ops = []
        for rec in records:
            gid = rec.get("glacier_id") or self._generate_id(rec)
            rec["glacier_id"] = gid
            rec["source"] = source
            rec["downloaded_at"] = datetime.now(timezone.utc)
            ops.append(UpdateOne(
                {"glacier_id": gid},
                {"$set": rec},
                upsert=True
            ))
        if not ops:
            return 0
        result = self.db["glaciers_raw"].bulk_write(ops, ordered=False)
        count = result.upserted_count + result.modified_count
        logger.info(f"💾 Upserted {count} raw records from '{source}'")
        return count

    def upsert_processed_glaciers(self, records: List[Dict]) -> int:
        """Upsert processed glacier records and store a snapshot in history."""
        if not self.is_connected():
            return 0
        from pymongo import UpdateOne
        ops = []
        history_entries = []
        ts = datetime.now(timezone.utc)
        
        for rec in records:
            gid = rec.get("glacier_id")
            if not gid:
                continue
            
            rec["processed_at"] = ts
            
            # Prepare update for current status
            ops.append(UpdateOne(
                {"glacier_id": gid},
                {"$set": rec},
                upsert=True
            ))
            
            # Prepare history entry
            history_entries.append({
                "glacier_id": gid,
                "timestamp": ts,
                "area_km2": rec.get("area_km2"),
                "status": rec.get("status"),
                "metadata": {
                    "source": rec.get("source"),
                    "region": rec.get("region")
                }
            })
            
        if not ops:
            return 0
            
        # Update current status
        result = self.db["glaciers_processed"].bulk_write(ops, ordered=False)
        
        # Insert history
        if history_entries:
            self.db["glacier_history"].insert_many(history_entries)
            
        count = result.upserted_count + result.modified_count
        logger.info(f"✅ Upserted {count} processed records and history snapshots")
        return count

    def get_glacier_history(self, glacier_id: str, limit: int = 10) -> List[Dict]:
        """Retrieve historical snapshots for a specific glacier."""
        if not self.is_connected():
            return []
        try:
            cursor = self.db["glacier_history"].find(
                {"glacier_id": glacier_id}
            ).sort("timestamp", -1).limit(limit)
            return list(cursor)
        except Exception as e:
            logger.error(f"Failed to fetch history for {glacier_id}: {e}")
            return []

    # ─────────────────────────────────────────────
    # DELETE / CLEANUP
    # ─────────────────────────────────────────────
    def delete_old_raw_data(self, source: str, keep_latest_n: int = 1) -> int:
        """
        Delete previous raw data for a source, keeping only the latest N downloads.
        Returns number of deleted documents.
        """
        if not self.is_connected():
            return 0
        try:
            # Find all distinct download timestamps for this source
            timestamps = self.db["glaciers_raw"].distinct(
                "downloaded_at", {"source": source}
            )
            timestamps_sorted = sorted(timestamps, reverse=True)
            if len(timestamps_sorted) <= keep_latest_n:
                return 0
            cutoff_timestamps = timestamps_sorted[keep_latest_n:]
            result = self.db["glaciers_raw"].delete_many({
                "source": source,
                "downloaded_at": {"$in": cutoff_timestamps}
            })
            logger.info(f"🗑  Deleted {result.deleted_count} old raw records for '{source}'")
            return result.deleted_count
        except Exception as e:
            logger.error(f"Delete failed: {e}")
            return 0

    def delete_old_processed_data(self, keep_latest_run: bool = True) -> int:
        """Replace processed collection with fresh data (delete all before re-insert)."""
        if not self.is_connected():
            return 0
        try:
            result = self.db["glaciers_processed"].delete_many({})
            logger.info(f"🗑  Cleared {result.deleted_count} processed records for fresh run")
            return result.deleted_count
        except Exception as e:
            logger.error(f"Delete processed failed: {e}")
            return 0

    # ─────────────────────────────────────────────
    # LOGGING
    # ─────────────────────────────────────────────
    def log_event(self, event: str, source: str, details: Dict = None, status: str = "success"):
        """Write a pipeline event to the logs collection."""
        if not self.is_connected():
            return
        try:
            entry = {
                "event": event,
                "source": source,
                "status": status,
                "timestamp": datetime.now(timezone.utc),
                "details": details or {}
            }
            self.db["pipeline_logs"].insert_one(entry)
            logger.debug(f"📝 Logged event: {event} | {source} | {status}")
        except Exception as e:
            logger.error(f"Log write failed: {e}")

    def get_logs(self, limit: int = 50) -> List[Dict]:
        """Fetch recent pipeline logs."""
        if not self.is_connected():
            return []
        try:
            cursor = self.db["pipeline_logs"].find(
                {}, {"_id": 0}
            ).sort("timestamp", -1).limit(limit)
            return list(cursor)
        except Exception:
            return []

    def get_all_processed(self) -> List[Dict]:
        """Fetch all processed glacier records."""
        if not self.is_connected():
            return []
        try:
            return list(self.db["glaciers_processed"].find({}, {"_id": 0}))
        except Exception:
            return []

    # ─────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────
    def _generate_id(self, record: Dict) -> str:
        """Generate a stable ID from key fields."""
        key = f"{record.get('name','')}-{record.get('lat','')}-{record.get('lon','')}"
        return hashlib.md5(key.encode()).hexdigest()[:16]

    def close(self):
        if self.client:
            self.client.close()
            logger.info("🔌 MongoDB connection closed")
