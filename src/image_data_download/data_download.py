"""
================================================
  GLACIER DATA COLLECTION PIPELINE — INDIA
================================================
Sources:
  - NASA EarthData  : MODIS Terra/Aqua (MOD10A1 - Snow Cover)
  - Copernicus      : Sentinel-2 (via OpenEO / CDSE free API)
  - USGS            : Landsat 8/9 (via USGS M2M API)
  - NSIDC           : Randolph Glacier Inventory (RGI 7.0) — static inventory

Output:
  - MongoDB database : glacier_db
  - JSON files       : output/glaciers_<date>.json
  - CSV files        : output/glaciers_<date>.csv
  - Log file         : logs/pipeline.log

Run:
  python collect_glacier_data.py --region all --days 30
  python collect_glacier_data.py --region himalaya --days 7
================================================
"""

import os
import sys
import json
import time
import logging
import argparse
import hashlib
import mimetypes
import re
import requests
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse
from typing import Any

def load_env_file():
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ[key] = value


load_env_file()

# —— Optional imports (graceful fallback) ——————————————————————————————
try:
    from pymongo import MongoClient, UpdateOne
    MONGO_AVAILABLE = True
except ImportError:
    MONGO_AVAILABLE = False
    print("[WARN] pymongo not installed. MongoDB storage disabled.")

try:
    import rasterio
    from rasterio.warp import calculate_default_transform, reproject, Resampling
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False
    print("[WARN] rasterio not installed. TIF reprojection disabled.")

# —————————————————————————————————————————————————————————————————————————————
#  CONFIGURATION
# —————————————————————————————————————————————————————————————————————————————

CONFIG = {
    # —— Paths ——
    "output_dir":    "output",
    "raw_dir":       "raw_data",
    "log_dir":       "logs",
    "state_file":    str(Path("output") / "realtime_state.json"),

    # —— MongoDB ——
    "mongo_uri":     "mongodb://localhost:27017/",
    "mongo_db":      "glacier_db",
    "mongo_col":     "glacier_records",

    # —— NASA EarthData credentials ——
    # Register FREE at: https://urs.earthdata.nasa.gov/
    "nasa_user":     os.getenv("NASA_USER", ""),
    "nasa_pass":     os.getenv("NASA_PASS", ""),

    # —— Copernicus / CDSE credentials ——
    # Register FREE at: https://dataspace.copernicus.eu/
    "copernicus_user": os.getenv("CDSE_USER", ""),
    "copernicus_pass": os.getenv("CDSE_PASS", ""),

    # —— USGS M2M API credentials ——
    # Register FREE at: https://ers.cr.usgs.gov/
    "usgs_user":     os.getenv("USGS_USER", ""),
    "usgs_pass":     os.getenv("USGS_PASS", ""),
}

# —— Indian Glacier Regions (Bounding Boxes: [lon_min, lat_min, lon_max, lat_max]) ——
REGIONS = {
    "himalaya": {
        "label":  "Himalaya (Eastern + Central)",
        "bbox":   [75.0, 28.0, 97.0, 36.5],
        "states": ["Himachal Pradesh", "Uttarakhand", "Sikkim", "Arunachal Pradesh"],
    },
    "karakoram": {
        "label":  "Karakoram Range",
        "bbox":   [74.0, 34.0, 78.5, 37.5],
        "states": ["Ladakh (J&K)"],
    },
    "western_himalaya": {
        "label":  "Western Himalaya (Zanskar / Ladakh)",
        "bbox":   [74.5, 32.5, 78.5, 35.5],
        "states": ["Ladakh", "Jammu & Kashmir"],
    },
    "all": {
        "label":  "All India Glaciers",
        "bbox":   [73.0, 27.5, 97.5, 37.5],
        "states": ["All"],
    },
}

# —————————————————————————————————————————————————————————————————————————————
#  LOGGING SETUP
# —————————————————————————————————————————————————————————————————————————————

def setup_logging():
    Path(CONFIG["log_dir"]).mkdir(exist_ok=True)
    log_file = Path(CONFIG["log_dir"]) / f"pipeline_{datetime.now():%Y%m%d}.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(message)s",
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(),
        ],
    )
    return logging.getLogger("glacier_pipeline")


def _parse_iso_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return datetime.fromisoformat(value)
    except Exception:
        return None


def _load_realtime_state(path: str) -> dict[str, Any]:
    try:
        p = Path(path)
        if not p.exists():
            return {}
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_realtime_state(path: str, state: dict[str, Any]) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(state, indent=2, default=str), encoding="utf-8")


# —————————————————————————————————————————————————————————————————————————————
#  MONGODB HANDLER
# —————————————————————————————————————————————————————————————————————————————

class MongoHandler:
    """Store, retrieve, and manage glacier records in MongoDB."""

    def __init__(self, logger):
        self.logger = logger
        self.client = None
        self.col = None
        if MONGO_AVAILABLE:
            try:
                self.client = MongoClient(CONFIG["mongo_uri"], serverSelectionTimeoutMS=3000)
                self.client.server_info()
                db = self.client[CONFIG["mongo_db"]]
                self.col = db[CONFIG["mongo_col"]]
                self.col.create_index("record_id", unique=True)
                self.logger.info("MongoDB connected.")
            except Exception as e:
                self.logger.warning(f"MongoDB unavailable: {e}. Continuing without DB.")
                self.col = None

    def upsert_records(self, records: list[dict]) -> int:
        if self.col is None or not records:
            return 0
        ops = [
            UpdateOne({"record_id": r["record_id"]}, {"$set": r}, upsert=True)
            for r in records
        ]
        result = self.col.bulk_write(ops)
        return result.upserted_count + result.modified_count

    def record_exists(self, record_id: str) -> bool:
        if self.col is None:
            return False
        return self.col.count_documents({"record_id": record_id}, limit=1) > 0

    def get_all(self) -> list[dict]:
        if self.col is None:
            return []
        return list(self.col.find({}, {"_id": 0}))

    def delete_old_records(self, days: int = 90):
        if self.col is None:
            return 0
        cutoff = datetime.utcnow() - timedelta(days=days)
        result = self.col.delete_many({"fetched_at": {"$lt": cutoff.isoformat()}})
        self.logger.info(f"Deleted {result.deleted_count} records older than {days} days.")
        return result.deleted_count


# —————————————————————————————————————————————————————————————————————————————
#  SOURCE 1 — NSIDC / RGI 7.0  (Free Glacier Inventory, No Auth Required)
# —————————————————————————————————————————————————————————————————————————————

class RGICollector:
    """
    Randolph Glacier Inventory 7.0 — global static inventory.
    Region 13 = Central Asia (includes Karakoram)
    Region 14 = South Asia West (Western Himalaya)
    Region 15 = South Asia East (Eastern Himalaya)
    API: https://api.nsidc.org/atlas/
    """

    BASE_URL = "https://api.nsidc.org/atlas/seaice/v3/"
    # RGI public endpoint — no authentication required
    RGI_SUMMARY = "https://www.glims.org/RGI/rgi60_files/rgi60.zip"

    def __init__(self, logger):
        self.logger = logger
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "GlacierPipeline/1.0"})

    def fetch_glims_region(self, bbox: list, region_label: str) -> list[dict]:
        """
        Query GLIMS (Global Land Ice Measurements from Space) database.
        Free, no auth. Returns glacier outlines for a bounding box.
        URL: https://www.glims.org/services/
        """
        lon_min, lat_min, lon_max, lat_max = bbox
        url = "https://www.glims.org/geoserver/ows"
        params = {
            "SERVICE":      "WFS",
            "VERSION":      "1.1.0",
            "REQUEST":      "GetFeature",
            "TYPENAME":     "GLIMS:GLIMS_Glacier_Outlines",
            "BBOX":         f"{lat_min},{lon_min},{lat_max},{lon_max}",
            "MAXFEATURES":  500,
            "OUTPUTFORMAT": "application/json",
        }

        self.logger.info(f"[GLIMS] Querying glaciers in {region_label} ...")
        records = []
        try:
            resp = self.session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            features = data.get("features", [])
            self.logger.info(f"[GLIMS] Found {len(features)} glacier features.")

            for feat in features:
                props = feat.get("properties", {})
                geom  = feat.get("geometry", {})
                coords = []
                geom_type = geom.get("type")
                if geom_type == "Point":
                    coords = geom.get("coordinates", [])
                elif geom_type == "Polygon":
                    poly_coords = geom.get("coordinates", [[]])[0]
                    if poly_coords:
                        lons = [c[0] for c in poly_coords if isinstance(c, (list, tuple)) and len(c) >= 2]
                        lats = [c[1] for c in poly_coords if isinstance(c, (list, tuple)) and len(c) >= 2]
                        if lons and lats:
                            coords = [sum(lons) / len(lons), sum(lats) / len(lats)]
                elif geom_type == "MultiPolygon":
                    # Use the first polygon's outer boundary
                    try:
                        poly_coords = geom.get("coordinates", [[[[]]]])[0][0]
                        if poly_coords:
                            lons = [c[0] for c in poly_coords if isinstance(c, (list, tuple)) and len(c) >= 2]
                            lats = [c[1] for c in poly_coords if isinstance(c, (list, tuple)) and len(c) >= 2]
                            if lons and lats:
                                coords = [sum(lons) / len(lons), sum(lats) / len(lats)]
                    except Exception:
                        pass

                glac_id = props.get("glac_id", "")
                raw_name = props.get("glac_name")
                if not raw_name or raw_name == "None" or raw_name == "Unknown":
                    glacier_name = f"Glacier {glac_id}" if glac_id else "Unnamed Glacier"
                else:
                    glacier_name = raw_name

                rec = {
                    "record_id":    self._make_id("glims", glac_id, props.get("anlys_id", "")),
                    "source":       "GLIMS/RGI",
                    "region":       region_label,
                    "glacier_id":   glac_id,
                    "glacier_name": glacier_name,
                    "area_km2":     props.get("db_area") or props.get("area"),
                    "longitude":    coords[0] if len(coords) > 0 else None,
                    "latitude":     coords[1] if len(coords) > 1 else None,
                    "elevation_m":  props.get("mean_elev", None),
                    "country":      props.get("prim_clas", "India"),
                    "analysis_date": props.get("src_date") or props.get("anlys_time", None),
                    "fetched_at":   datetime.utcnow().isoformat(),
                }
                records.append(rec)

            # Batch query Open-Meteo elevation API for all valid coordinates
            valid_coords_records = [r for r in records if r["latitude"] is not None and r["longitude"] is not None]
            if valid_coords_records:
                self.logger.info(f"[Elevation] Fetching elevations from Open-Meteo for {len(valid_coords_records)} records...")
                chunk_size = 100
                for k in range(0, len(valid_coords_records), chunk_size):
                    chunk = valid_coords_records[k:k+chunk_size]
                    lats = ",".join(str(r["latitude"]) for r in chunk)
                    lons = ",".join(str(r["longitude"]) for r in chunk)
                    elev_url = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}"
                    try:
                        elev_resp = self.session.get(elev_url, timeout=10)
                        elev_resp.raise_for_status()
                        elev_data = elev_resp.json()
                        elevations = elev_data.get("elevation", [])
                        for r, elev in zip(chunk, elevations):
                            r["elevation_m"] = elev
                    except Exception as e:
                        self.logger.warning(f"[Elevation] Failed to fetch chunk: {e}")

        except requests.exceptions.ConnectionError:
            self.logger.warning("[GLIMS] Could not connect. Using demo data.")
            records = self._demo_data(region_label)
        except Exception as e:
            self.logger.error(f"[GLIMS] Error: {e}")
            records = self._demo_data(region_label)

        return records

    def _make_id(self, source, *parts) -> str:
        raw = f"{source}_{'_'.join(str(p) for p in parts)}"
        return hashlib.md5(raw.encode()).hexdigest()[:16]

    def _demo_data(self, region_label: str) -> list[dict]:
        """Fallback demo records for testing without network."""
        demo = [
            {"glacier_name": "Gangotri",    "latitude": 30.9228, "longitude": 79.0669, "area_km2": 286.3, "elevation_m": 4200},
            {"glacier_name": "Zemu",         "latitude": 27.7300, "longitude": 88.1500, "area_km2": 197.0, "elevation_m": 5300},
            {"glacier_name": "Siachen",      "latitude": 35.4200, "longitude": 77.1100, "area_km2": 700.0, "elevation_m": 5400},
            {"glacier_name": "Baltoro",      "latitude": 35.7200, "longitude": 76.5000, "area_km2": 524.0, "elevation_m": 5100},
            {"glacier_name": "Milam",        "latitude": 30.4500, "longitude": 80.2600, "area_km2": 34.5,  "elevation_m": 3900},
            {"glacier_name": "Satopanth",    "latitude": 30.7400, "longitude": 79.3600, "area_km2": 23.5,  "elevation_m": 4000},
            {"glacier_name": "Chorabari",    "latitude": 30.7700, "longitude": 79.0600, "area_km2": 6.6,   "elevation_m": 3900},
            {"glacier_name": "Pindari",      "latitude": 30.2700, "longitude": 79.9500, "area_km2": 3.7,   "elevation_m": 3660},
            {"glacier_name": "Dudhkosi",     "latitude": 27.8500, "longitude": 86.7500, "area_km2": 12.0,  "elevation_m": 5000},
            {"glacier_name": "South Rathong","latitude": 27.5500, "longitude": 88.3500, "area_km2": 5.2,   "elevation_m": 4940},
        ]
        records = []
        for d in demo:
            rec = {
                "record_id":    self._make_id("demo", d["glacier_name"]),
                "source":       "DEMO/GLIMS",
                "region":       region_label,
                "glacier_name": d["glacier_name"],
                "area_km2":     d["area_km2"],
                "latitude":     d["latitude"],
                "longitude":    d["longitude"],
                "elevation_m":  d["elevation_m"],
                "country":      "India",
                "analysis_date": datetime.utcnow().strftime("%Y-%m-%d"),
                "fetched_at":   datetime.utcnow().isoformat(),
            }
            records.append(rec)
        return records


# —————————————————————————————————————————————————————————————————————————————
#  SOURCE 2 — NASA CMR (Common Metadata Repository) — Free, No Auth for search
# —————————————————————————————————————————————————————————————————————————————

class NASACollector:
    """
    Search NASA EarthData CMR for MODIS Snow Cover (MOD10A1) granules.
    Search is FREE with no auth. Download requires free EarthData account.
    Register: https://urs.earthdata.nasa.gov/
    """

    CMR_URL = "https://cmr.earthdata.nasa.gov/search/granules.json"

    def __init__(self, logger):
        self.logger = logger
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "GlacierPipeline/1.0"})

    def search_modis_snow(self, bbox: list, days_back: int = 30) -> list[dict]:
        """
        Search for MOD10A1 (MODIS/Terra Snow Cover Daily) granules.
        Returns metadata records (no download unless credentials set).
        """
        end   = datetime.utcnow()
        start = end - timedelta(days=days_back)
        lon_min, lat_min, lon_max, lat_max = bbox

        params = {
            "short_name":        "MOD10A1",
            "version":           "61",
            "temporal":          f"{start:%Y-%m-%dT00:00:00Z},{end:%Y-%m-%dT23:59:59Z}",
            "bounding_box":      f"{lon_min},{lat_min},{lon_max},{lat_max}",
            "page_size":         50,
            "sort_key":          "-start_date",
        }

        self.logger.info(f"[NASA CMR] Searching MOD10A1 for last {days_back} days ...")
        records = []
        try:
            resp = self.session.get(self.CMR_URL, params=params, timeout=30)
            resp.raise_for_status()
            entries = resp.json().get("feed", {}).get("entry", [])
            self.logger.info(f"[NASA CMR] Found {len(entries)} MODIS granules.")

            for e in entries:
                links = [l["href"] for l in e.get("links", []) if l.get("rel") == "http://esipfed.org/ns/fedsearch/1.1/data#"]
                rec = {
                    "record_id":     hashlib.md5(e.get("id", "").encode()).hexdigest()[:16],
                    "source":        "NASA/MODIS-MOD10A1",
                    "granule_id":    e.get("id", ""),
                    "title":         e.get("title", ""),
                    "time_start":    e.get("time_start", ""),
                    "time_end":      e.get("time_end", ""),
                    "cloud_cover":   e.get("cloud_cover", None),
                    "download_url":  links[0] if links else None,
                    "bbox":          e.get("boxes", [None])[0],
                    "fetched_at":    datetime.utcnow().isoformat(),
                }
                records.append(rec)

        except requests.exceptions.ConnectionError:
            self.logger.warning("[NASA CMR] No connection. Skipping.")
        except Exception as e:
            self.logger.error(f"[NASA CMR] Error: {e}")

        return records

    def search_landsat(self, bbox: list, days_back: int = 30) -> list[dict]:
        """
        Search for Landsat 8/9 Collection 2 Level-2 granules via CMR.
        """
        end   = datetime.utcnow()
        start = end - timedelta(days=days_back)
        lon_min, lat_min, lon_max, lat_max = bbox

        params = {
            "short_name":   "LANDSAT_OT_C2_L2",
            "temporal":     f"{start:%Y-%m-%dT00:00:00Z},{end:%Y-%m-%dT23:59:59Z}",
            "bounding_box": f"{lon_min},{lat_min},{lon_max},{lat_max}",
            "page_size":    30,
            "sort_key":     "-start_date",
        }

        self.logger.info(f"[NASA CMR] Searching Landsat 8/9 ...")
        records = []
        try:
            resp = self.session.get(self.CMR_URL, params=params, timeout=30)
            resp.raise_for_status()
            entries = resp.json().get("feed", {}).get("entry", [])
            self.logger.info(f"[NASA CMR] Found {len(entries)} Landsat granules.")

            for e in entries:
                links = [l["href"] for l in e.get("links", []) if "data#" in l.get("rel", "")]
                rec = {
                    "record_id":    hashlib.md5(e.get("id", "").encode()).hexdigest()[:16],
                    "source":       "NASA/Landsat-OLI",
                    "granule_id":   e.get("id", ""),
                    "title":        e.get("title", ""),
                    "time_start":   e.get("time_start", ""),
                    "cloud_cover":  e.get("cloud_cover", None),
                    "download_url": links[0] if links else None,
                    "fetched_at":   datetime.utcnow().isoformat(),
                }
                records.append(rec)

        except Exception as e:
            self.logger.warning(f"[NASA CMR] Landsat search error: {e}")

        return records


# —————————————————————————————————————————————————————————————————————————————
#  SOURCE 3 — Copernicus Dataspace (Sentinel-1 & Sentinel-2) — Free
# —————————————————————————————————————————————————————————————————————————————

class CopernicusCollector:
    """
    Search Copernicus Data Space Ecosystem for Sentinel-1 and Sentinel-2 imagery.
    Register FREE at: https://dataspace.copernicus.eu/
    Search endpoint is completely open (no auth for metadata).
    """

    SEARCH_URL = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"

    def __init__(self, logger):
        self.logger = logger
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "GlacierPipeline/1.0"})

    def search_sentinel2(self, bbox: list, days_back: int = 30, max_cloud: int = 30) -> list[dict]:
        """
        Search for Sentinel-2 L2A products (surface reflectance, cloud-masked).
        """
        end   = datetime.utcnow()
        start = end - timedelta(days=days_back)
        lon_min, lat_min, lon_max, lat_max = bbox

        footprint = (
            f"POLYGON(({lon_min} {lat_min},{lon_max} {lat_min},"
            f"{lon_max} {lat_max},{lon_min} {lat_max},{lon_min} {lat_min}))"
        )

        params = {
            "$filter": (
                f"Collection/Name eq 'SENTINEL-2' "
                f"and Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' "
                f"  and att/OData.CSC.StringAttribute/Value eq 'S2MSI2A') "
                f"and ContentDate/Start gt {start:%Y-%m-%dT00:00:00.000Z} "
                f"and ContentDate/Start lt {end:%Y-%m-%dT23:59:59.000Z} "
                f"and OData.CSC.Intersects(area=geography'SRID=4326;{footprint}') "
                f"and Attributes/OData.CSC.DoubleAttribute/any(att:att/Name eq 'cloudCover' "
                f"  and att/OData.CSC.DoubleAttribute/Value lt {max_cloud})"
            ),
            "$orderby": "ContentDate/Start desc",
            "$top":     50,
        }

        self.logger.info(f"[Copernicus] Searching Sentinel-2 L2A (cloud < {max_cloud}%) ...")
        records = []
        try:
            resp = self.session.get(self.SEARCH_URL, params=params, timeout=30)
            resp.raise_for_status()
            items = resp.json().get("value", [])
            self.logger.info(f"[Copernicus] Found {len(items)} Sentinel-2 products.")

            for item in items:
                attrs = {a["Name"]: a.get("Value") for a in item.get("Attributes", [])}
                rec = {
                    "record_id":     hashlib.md5(item.get("Id", "").encode()).hexdigest()[:16],
                    "source":        "Copernicus/Sentinel-2-L2A",
                    "product_id":    item.get("Id", ""),
                    "product_name":  item.get("Name", ""),
                    "date_acquired": item.get("ContentDate", {}).get("Start", ""),
                    "cloud_cover":   attrs.get("cloudCover"),
                    "platform":      attrs.get("platformShortName", "Sentinel-2"),
                    "size_mb":       round(item.get("ContentLength", 0) / 1e6, 1),
                    "download_url":  f"https://download.dataspace.copernicus.eu/odata/v1/Products({item.get('Id', '')})/$value",
                    "fetched_at":    datetime.utcnow().isoformat(),
                }
                records.append(rec)

        except requests.exceptions.ConnectionError:
            self.logger.warning("[Copernicus] No connection. Skipping.")
        except Exception as e:
            self.logger.error(f"[Copernicus] Error: {e}")

        return records

    def search_sentinel1(
        self,
        bbox: list,
        days_back: int = 30,
        product_type: str = "GRD",
        max_results: int = 50,
    ) -> list[dict]:
        """
        Search Copernicus Data Space catalogue for Sentinel-1 products.

        Metadata search is open (no auth). Download requires `CDSE_USER`/`CDSE_PASS`.
        """
        end = datetime.utcnow()
        start = end - timedelta(days=days_back)
        lon_min, lat_min, lon_max, lat_max = bbox

        footprint = (
            f"POLYGON(({lon_min} {lat_min},{lon_max} {lat_min},"
            f"{lon_max} {lat_max},{lon_min} {lat_max},{lon_min} {lat_min}))"
        )

        params = {
            "$filter": (
                f"Collection/Name eq 'SENTINEL-1' "
                f"and Attributes/OData.CSC.StringAttribute/any(att:att/Name eq 'productType' "
                f"  and att/OData.CSC.StringAttribute/Value eq '{product_type}') "
                f"and ContentDate/Start gt {start:%Y-%m-%dT00:00:00.000Z} "
                f"and ContentDate/Start lt {end:%Y-%m-%dT23:59:59.000Z} "
                f"and OData.CSC.Intersects(area=geography'SRID=4326;{footprint}')"
            ),
            "$orderby": "ContentDate/Start desc",
            "$top": int(max_results),
        }

        self.logger.info(f"[Copernicus] Searching Sentinel-1 ({product_type}) ...")
        records = []
        try:
            resp = self.session.get(self.SEARCH_URL, params=params, timeout=30)
            resp.raise_for_status()
            items = resp.json().get("value", [])
            self.logger.info(f"[Copernicus] Found {len(items)} Sentinel-1 products.")

            for item in items:
                attrs = {a["Name"]: a.get("Value") for a in item.get("Attributes", [])}
                rec = {
                    "record_id":     hashlib.md5(item.get("Id", "").encode()).hexdigest()[:16],
                    "source":        f"Copernicus/Sentinel-1-{product_type}",
                    "product_id":    item.get("Id", ""),
                    "product_name":  item.get("Name", ""),
                    "date_acquired": item.get("ContentDate", {}).get("Start", ""),
                    "platform":      attrs.get("platformShortName", "Sentinel-1"),
                    "size_mb":       round(item.get("ContentLength", 0) / 1e6, 1),
                    "download_url":  f"https://download.dataspace.copernicus.eu/odata/v1/Products({item.get('Id', '')})/$value",
                    "fetched_at":    datetime.utcnow().isoformat(),
                }
                records.append(rec)

        except requests.exceptions.ConnectionError:
            self.logger.warning("[Copernicus] No connection. Skipping.")
        except Exception as e:
            self.logger.error(f"[Copernicus] Error: {e}")

        return records


# —————————————————————————————————————————————————————————————————————————————
#  OUTPUT HANDLER
# —————————————————————————————————————————————————————————————————————————————

class OutputHandler:
    """Save records to JSON and CSV files, manage old files, write logs."""

    def __init__(self, logger):
        self.logger = logger
        Path(CONFIG["output_dir"]).mkdir(exist_ok=True)
        Path(CONFIG["raw_dir"]).mkdir(exist_ok=True)

    def save_json(self, records: list[dict], tag: str) -> str:
        today = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = Path(CONFIG["output_dir"]) / f"glaciers_{tag}_{today}.json"
        with open(path, "w") as f:
            json.dump(records, f, indent=2, default=str)
        self.logger.info(f"[Output] JSON saved -> {path}  ({len(records)} records)")
        return str(path)

    def save_csv(self, records: list[dict], tag: str) -> str:
        today = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = Path(CONFIG["output_dir"]) / f"glaciers_{tag}_{today}.csv"
        df = pd.DataFrame(records)
        df.to_csv(path, index=False)
        self.logger.info(f"[Output] CSV  saved -> {path}  ({len(records)} records)")
        return str(path)

    def delete_old_files(self, days: int = 30):
        cutoff = datetime.now() - timedelta(days=days)
        deleted = []
        for pattern in ["*.json", "*.csv"]:
            for f in Path(CONFIG["output_dir"]).glob(pattern):
                if datetime.fromtimestamp(f.stat().st_mtime) < cutoff:
                    f.unlink()
                    deleted.append(f.name)
        if deleted:
            self.logger.info(f"[Cleanup] Deleted {len(deleted)} old output files.")
        return deleted

    def write_change_log(self, summary: dict):
        log_path = Path(CONFIG["log_dir"]) / "change_log.jsonl"
        with open(log_path, "a") as f:
            f.write(json.dumps(summary, default=str) + "\n")
        self.logger.info(f"[Log] Change summary appended -> {log_path}")


# —————————————————————————————————————————————————————————————————————————————
#  CHANGE DETECTION
# —————————————————————————————————————————————————————————————————————————————

class ImageDownloader:
    """Download actual imagery files from metadata records."""

    COPERNICUS_TOKEN_URL = (
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/"
        "protocol/openid-connect/token"
    )

    def __init__(self, logger):
        self.logger = logger
        self.root = Path(CONFIG["raw_dir"])
        self.root.mkdir(exist_ok=True)
        self._copernicus_token = None
        self._copernicus_auth_failed = False

    def _sanitize_filename(self, text: str, fallback: str = "file") -> str:
        cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", (text or "").strip())
        cleaned = cleaned.strip("._")
        return cleaned[:120] if cleaned else fallback

    def _guess_extension(self, url: str, content_type: str | None = None) -> str:
        ext = Path(urlparse(url).path).suffix.lower()
        if ext:
            return ext
        if content_type:
            guessed = mimetypes.guess_extension(content_type.split(";")[0].strip())
            if guessed:
                return guessed
        return ".bin"

    def _get_copernicus_token(self) -> str | None:
        if self._copernicus_auth_failed:
            return None
        if self._copernicus_token:
            return self._copernicus_token

        user = CONFIG.get("copernicus_user")
        pwd = CONFIG.get("copernicus_pass")
        if not user or not pwd:
            self.logger.warning("[Download] CDSE_USER/CDSE_PASS not set. Copernicus downloads may fail.")
            return None

        try:
            resp = requests.post(
                self.COPERNICUS_TOKEN_URL,
                data={
                    "grant_type": "password",
                    "client_id": "cdse-public",
                    "username": user,
                    "password": pwd,
                },
                timeout=30,
            )
            resp.raise_for_status()
            self._copernicus_token = resp.json().get("access_token")
            return self._copernicus_token
        except requests.HTTPError as e:
            code = e.response.status_code if e.response else "unknown"
            self._copernicus_auth_failed = True
            self.logger.warning(
                f"[Download] Copernicus token fetch failed (HTTP {code}). "
                "Check CDSE_USER/CDSE_PASS credentials or account access."
            )
            return None
        except Exception as e:
            self._copernicus_auth_failed = True
            self.logger.warning(f"[Download] Copernicus token fetch failed: {e}")
            return None

    def _session_for_source(self, source: str) -> requests.Session:
        session = requests.Session()
        session.headers.update({"User-Agent": "GlacierPipeline/1.0"})

        if source.startswith("NASA/") and CONFIG["nasa_user"] and CONFIG["nasa_pass"]:
            session.auth = (CONFIG["nasa_user"], CONFIG["nasa_pass"])
        elif source.startswith("Copernicus/"):
            token = self._get_copernicus_token()
            if token:
                session.headers.update({"Authorization": f"Bearer {token}"})
        return session

    def _source_auth_ready(self, source: str) -> bool:
        if source.startswith("NASA/"):
            return bool(CONFIG.get("nasa_user") and CONFIG.get("nasa_pass"))
        if source.startswith("Copernicus/"):
            return bool(CONFIG.get("copernicus_user") and CONFIG.get("copernicus_pass"))
        return True

    def _record_filename(self, record: dict, ext: str) -> str:
        stem = (
            record.get("granule_id")
            or record.get("product_name")
            or record.get("title")
            or record.get("record_id")
            or "record"
        )
        return f"{self._sanitize_filename(stem)}{ext}"

    def _copernicus_url_candidates(self, record: dict) -> list[str]:
        product_id = (record.get("product_id") or "").strip()
        primary = record.get("download_url")
        if not product_id:
            return [primary] if primary else []

        candidates = [
            f"https://download.dataspace.copernicus.eu/odata/v1/Products({product_id})/$value",
            f"https://download.dataspace.copernicus.eu/odata/v1/Products('{product_id}')/$value",
            f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products({product_id})/$value",
            f"https://catalogue.dataspace.copernicus.eu/odata/v1/Products('{product_id}')/$value",
            primary,
        ]
        deduped = []
        seen = set()
        for url in candidates:
            if url and url not in seen:
                deduped.append(url)
                seen.add(url)
        return deduped

    def _download_one(self, session: requests.Session, record: dict, out_dir: Path) -> bool:
        source = record.get("source", "")
        if source.startswith("Copernicus/"):
            candidate_urls = self._copernicus_url_candidates(record)
        else:
            url = record.get("download_url")
            candidate_urls = [url] if url else []

        if not candidate_urls:
            record["download_status"] = "no_url"
            return False

        for idx, url in enumerate(candidate_urls):
            try:
                with session.get(url, stream=True, timeout=120, allow_redirects=True) as resp:
                    resp.raise_for_status()
                    ext = self._guess_extension(url, resp.headers.get("Content-Type"))
                    target = out_dir / self._record_filename(record, ext)

                    if target.exists():
                        record["local_file"] = str(target)
                        record["download_status"] = "exists"
                        record["download_url_used"] = url
                        return True

                    with open(target, "wb") as f:
                        for chunk in resp.iter_content(chunk_size=1024 * 1024):
                            if chunk:
                                f.write(chunk)

                    record["local_file"] = str(target)
                    record["download_status"] = "downloaded"
                    record["download_url_used"] = url
                    record["downloaded_at"] = datetime.utcnow().isoformat()
                    return True
            except requests.HTTPError as e:
                code = e.response.status_code if e.response else "unknown"
                # For Copernicus, try alternate URL forms when initial form 404s.
                should_retry = (
                    source.startswith("Copernicus/")
                    and code == 404
                    and idx < len(candidate_urls) - 1
                )
                if should_retry:
                    continue
                record["download_status"] = f"http_{code}"
                self.logger.warning(f"[Download] HTTP error for {url}: {e}")
                return False
            except Exception as e:
                record["download_status"] = "failed"
                self.logger.warning(f"[Download] Failed for {url}: {e}")
                return False

        return False

    def download_records(
        self,
        records: list[dict],
        max_files: int = 20,
        source_filter: str = "both",
    ) -> dict:
        candidates = [
            r for r in records
            if r.get("download_url")
            and (r.get("source", "").startswith("NASA/") or r.get("source", "").startswith("Copernicus/"))
        ]
        if source_filter == "nasa":
            candidates = [r for r in candidates if r.get("source", "").startswith("NASA/")]
        elif source_filter == "copernicus":
            candidates = [r for r in candidates if r.get("source", "").startswith("Copernicus/")]

        # Prefer Copernicus first so one failing NASA auth does not consume all max_files slots.
        candidates.sort(key=lambda r: 0 if r.get("source", "").startswith("Copernicus/") else 1)
        auth_ready = [r for r in candidates if self._source_auth_ready(r.get("source", ""))]
        auth_blocked = [r for r in candidates if not self._source_auth_ready(r.get("source", ""))]
        selected = auth_ready if max_files == 0 else auth_ready[:max_files]
        self.logger.info(
            f"[Download] Starting file downloads for {len(selected)} records "
            f"(max_files={max_files}, source_filter={source_filter})."
        )
        if auth_blocked:
            self.logger.warning(
                f"[Download] Skipping {len(auth_blocked)} records due to missing credentials "
                f"(NASA_USER/NASA_PASS or CDSE_USER/CDSE_PASS)."
            )
            for rec in auth_blocked:
                rec["download_status"] = "skipped_missing_credentials"

        sessions: dict[str, requests.Session] = {}
        disabled_sources: set[str] = set()
        counts = {"attempted": 0, "downloaded": 0, "exists": 0, "failed": 0, "skipped": len(auth_blocked)}

        for record in selected:
            source = record.get("source", "")
            if source in disabled_sources:
                record["download_status"] = "skipped_source_auth_failed"
                counts["skipped"] += 1
                continue
            bucket = "nasa" if source.startswith("NASA/") else "copernicus"
            out_dir = self.root / bucket
            out_dir.mkdir(parents=True, exist_ok=True)

            if bucket not in sessions:
                sessions[bucket] = self._session_for_source(source)
                if bucket == "copernicus" and "Authorization" not in sessions[bucket].headers:
                    disabled_sources.add(source)
                    record["download_status"] = "skipped_source_auth_failed"
                    counts["skipped"] += 1
                    self.logger.warning(
                        "[Download] Copernicus authorization unavailable. "
                        "Skipping remaining Copernicus downloads for this run."
                    )
                    continue

            counts["attempted"] += 1
            ok = self._download_one(sessions[bucket], record, out_dir)
            if ok and record.get("download_status") == "exists":
                counts["exists"] += 1
            elif ok:
                counts["downloaded"] += 1
            else:
                counts["failed"] += 1
                # NASA protected links: once URS rejects one request, avoid repeating failures this run.
                if source.startswith("NASA/") and record.get("download_status") == "http_401":
                    disabled_sources.add(source)
                    self.logger.warning(
                        "[Download] NASA auth failed (401). Skipping remaining NASA downloads for this run. "
                        "Check Earthdata app authorization and NASA credentials."
                    )

        self.logger.info(
            f"[Download] Completed | attempted={counts['attempted']} downloaded={counts['downloaded']} "
            f"exists={counts['exists']} failed={counts['failed']} skipped={counts['skipped']}"
        )
        return counts


class ChangeDetector:
    """Compare current snapshot vs previous to detect glacier changes."""

    def __init__(self, logger):
        self.logger = logger

    def compare(self, current: list[dict], previous: list[dict]) -> dict:
        """
        Simple area-based change detection.
        Returns a summary dict with new, removed, and changed glaciers.
        """
        curr_map = {r.get("glacier_name", r.get("record_id")): r for r in current if r.get("glacier_name")}
        prev_map = {r.get("glacier_name", r.get("record_id")): r for r in previous if r.get("glacier_name")}

        new_glaciers     = [k for k in curr_map if k not in prev_map]
        removed_glaciers = [k for k in prev_map if k not in curr_map]
        changes = []

        for name in curr_map:
            if name in prev_map:
                curr_area = curr_map[name].get("area_km2")
                prev_area = prev_map[name].get("area_km2")
                if curr_area and prev_area and curr_area != prev_area:
                    delta = curr_area - prev_area
                    pct   = (delta / prev_area) * 100
                    changes.append({
                        "glacier_name": name,
                        "prev_area_km2": prev_area,
                        "curr_area_km2": curr_area,
                        "delta_km2":    round(delta, 3),
                        "change_pct":   round(pct, 2),
                        "trend":        "RETREATING" if delta < 0 else "ADVANCING",
                    })

        summary = {
            "timestamp":          datetime.utcnow().isoformat(),
            "total_current":      len(current),
            "total_previous":     len(previous),
            "new_detected":       len(new_glaciers),
            "removed_detected":   len(removed_glaciers),
            "area_changes":       len(changes),
            "new_glaciers":       new_glaciers,
            "removed_glaciers":   removed_glaciers,
            "significant_changes": [c for c in changes if abs(c["change_pct"]) > 1.0],
            "all_changes":        changes,
        }

        self.logger.info(
            f"[ChangeDetect] {len(changes)} area changes | "
            f"{len(new_glaciers)} new | {len(removed_glaciers)} removed"
        )
        return summary


# —————————————————————————————————————————————————————————————————————————————
#  MAIN PIPELINE
# —————————————————————————————————————————————————————————————————————————————

def run_pipeline(
    region_key: str = "all",
    days_back: int = 30,
    download_images: bool = False,
    max_downloads: int = 20,
    download_source: str = "both",
    satellites: str = "s1,s2",
    sentinel_only: bool = False,
    realtime: bool = False,
    poll_seconds: int = 900,
    s1_product_type: str = "GRD",
):
    if realtime:
        # Run one-shot inside a polling loop; keeps running until Ctrl+C.
        state_path = str(CONFIG.get("state_file") or (Path(CONFIG["output_dir"]) / "realtime_state.json"))
        state = _load_realtime_state(state_path)
        state_key = f"{region_key}|{s1_product_type}|{satellites or 's1,s2'}"
        last_seen_dt = _parse_iso_dt((state.get(state_key) or {}).get("last_seen"))

        logger = setup_logging()
        logger.info("=" * 60)
        logger.info("  SENTINEL REALTIME PIPELINE STARTED")
        logger.info(f"  Region: {region_key.upper()}  |  Days back: {days_back}")
        logger.info(f"  State file: {state_path}")
        if last_seen_dt:
            logger.info(f"  Last seen: {last_seen_dt.isoformat()}")
        logger.info("=" * 60)

        try:
            while True:
                result = run_pipeline(
                    region_key=region_key,
                    days_back=days_back,
                    download_images=download_images,
                    max_downloads=max_downloads,
                    download_source=download_source,
                    satellites=satellites,
                    sentinel_only=sentinel_only,
                    realtime=False,
                    poll_seconds=poll_seconds,
                    s1_product_type=s1_product_type,
                )
                newest = last_seen_dt
                for rec in (result.get("records") or []):
                    if not str(rec.get("source", "")).startswith("Copernicus/Sentinel-"):
                        continue
                    dt = _parse_iso_dt(rec.get("date_acquired"))
                    if dt and (newest is None or dt > newest):
                        newest = dt
                if newest and (last_seen_dt is None or newest > last_seen_dt):
                    state[state_key] = {"last_seen": newest.isoformat()}
                    _save_realtime_state(state_path, state)
                    last_seen_dt = newest
                    logger.info(f"[Realtime] Updated last_seen -> {newest.isoformat()}")
                logger.info(f"[Realtime] Sleeping {poll_seconds}s ... (Ctrl+C to stop)")
                time.sleep(max(5, int(poll_seconds)))
        except KeyboardInterrupt:
            logger.info("[Realtime] Stopped by user.")
            return {"status": "stopped", "state_file": state_path}

    logger  = setup_logging()
    pipeline_name = "SENTINEL PIPELINE" if sentinel_only else "GLACIER DATA COLLECTION PIPELINE"
    logger.info("=" * 60)
    logger.info(f"  {pipeline_name} STARTED")
    logger.info(f"  Region: {region_key.upper()}  |  Days back: {days_back}")
    logger.info("=" * 60)

    region = REGIONS.get(region_key, REGIONS["all"])
    bbox   = region["bbox"]

    mongo   = MongoHandler(logger)
    output  = OutputHandler(logger)
    detector = ChangeDetector(logger)

    # —— Load previous records for change detection ————————————————————————
    previous_records = mongo.get_all()
    logger.info(f"[Pipeline] {len(previous_records)} existing records in MongoDB.")

    all_records = []

    satellite_set = {s.strip().lower() for s in (satellites or "").split(",") if s.strip()}
    wants_s1 = "s1" in satellite_set or "sentinel1" in satellite_set or "sentinel-1" in satellite_set
    wants_s2 = "s2" in satellite_set or "sentinel2" in satellite_set or "sentinel-2" in satellite_set
    if not satellite_set:
        wants_s1, wants_s2 = True, True

    # —— Stage 1: GLIMS / RGI glacier inventory ——————————————————————————————
    glims_records: list[dict] = []
    if not sentinel_only:
        logger.info("\n[Stage 1] Fetching GLIMS glacier inventory ...")
        glims = RGICollector(logger)
        glims_records = glims.fetch_glims_region(bbox, region["label"])
        all_records.extend(glims_records)
        logger.info(f"[Stage 1] {len(glims_records)} GLIMS records collected.")

    # —— Stage 2: NASA MODIS + Landsat metadata ——————————————————————————————
    modis_records: list[dict] = []
    landsat_records: list[dict] = []
    if not sentinel_only:
        logger.info("\n[Stage 2] Fetching NASA satellite imagery metadata ...")
        nasa = NASACollector(logger)
        modis_records = nasa.search_modis_snow(bbox, days_back)
        landsat_records = nasa.search_landsat(bbox, days_back)
        all_records.extend(modis_records)
        all_records.extend(landsat_records)
        logger.info(f"[Stage 2] {len(modis_records)} MODIS + {len(landsat_records)} Landsat records.")

    # —— Stage 3: Copernicus Sentinel-2 metadata ——————————————————————————————
    cop = CopernicusCollector(logger)
    s1_records: list[dict] = []
    s2_records: list[dict] = []
    if wants_s1:
        logger.info("\n[Stage 3] Fetching Copernicus Sentinel-1 metadata ...")
        s1_records = cop.search_sentinel1(bbox, days_back, product_type=s1_product_type)
        all_records.extend(s1_records)
        logger.info(f"[Stage 3] {len(s1_records)} Sentinel-1 records.")
    if wants_s2:
        logger.info("\n[Stage 3] Fetching Copernicus Sentinel-2 metadata ...")
        s2_records = cop.search_sentinel2(bbox, days_back)
        all_records.extend(s2_records)
        logger.info(f"[Stage 3] {len(s2_records)} Sentinel-2 records.")

    logger.info(f"\n[Pipeline] Total records collected: {len(all_records)}")

    # —— Stage 4: Store in MongoDB —————————————————————————————————————————————
    download_summary = {"attempted": 0, "downloaded": 0, "exists": 0, "failed": 0}
    if download_images:
        logger.info("\n[Stage 4] Downloading actual imagery files ...")
        downloader = ImageDownloader(logger)
        download_summary = downloader.download_records(
            all_records,
            max_files=max_downloads,
            source_filter=download_source,
        )
    else:
        logger.info("\n[Stage 4] Skipped imagery download (use --download-images to enable).")

    if all_records:
        saved = mongo.upsert_records(all_records)
        logger.info(f"[Stage 5] MongoDB: {saved} records upserted.")

    # —— Stage 5: Change detection —————————————————————————————————————————————
    change_summary = {"area_changes": 0}
    if not sentinel_only:
        logger.info("\n[Stage 6] Running change detection ...")
        change_summary = detector.compare(all_records, previous_records)
        output.write_change_log(change_summary)

    # —— Stage 7: Save outputs —————————————————————————————————————————————————
    logger.info("\n[Stage 7] Saving output files ...")
    tag = f"{region_key}_{days_back}d"
    json_path = output.save_json(all_records, tag)
    csv_path  = output.save_csv(all_records, tag)

    if not sentinel_only:
        # Save change summary
        change_path = Path(CONFIG["output_dir"]) / f"changes_{tag}_{datetime.now():%Y%m%d_%H%M%S}.json"
        with open(change_path, "w") as f:
            json.dump(change_summary, f, indent=2, default=str)
        logger.info(f"[Stage 7] Change report -> {change_path}")

    # —— Stage 8: Cleanup old files —————————————————————————————————————————————
    logger.info("\n[Stage 8] Cleaning up old files ...")
    output.delete_old_files(days=30)
    mongo.delete_old_records(days=90)

    # —— Final Summary ——————————————————————————————————————————————————————————
    logger.info("\n" + "=" * 60)
    logger.info("  PIPELINE COMPLETE")
    logger.info(f"  Total records    : {len(all_records)}")
    if not sentinel_only:
        logger.info(f"  GLIMS glaciers   : {len(glims_records)}")
        logger.info(f"  MODIS granules   : {len(modis_records)}")
        logger.info(f"  Landsat granules : {len(landsat_records)}")
    if wants_s1:
        logger.info(f"  Sentinel-1       : {len(s1_records)}")
    if wants_s2:
        logger.info(f"  Sentinel-2       : {len(s2_records)}")
    logger.info(
        f"  Downloads        : {download_summary['downloaded']} new | "
        f"{download_summary['exists']} existing | {download_summary['failed']} failed"
    )
    if not sentinel_only:
        logger.info(f"  Area changes     : {change_summary['area_changes']}")
    logger.info(f"  JSON output      : {json_path}")
    logger.info(f"  CSV output       : {csv_path}")
    logger.info("=" * 60)

    # —— Stage 9: Automated Mapping & Ingestion ——————————————————————————————————
    if download_images and download_summary['downloaded'] > 0:
        logger.info("\n[Stage 9] Triggering automated mapping & ingestion ...")
        try:
            import subprocess
            auto_script = Path(__file__).parent.parent / "src" / "automated_pipeline.py"
            subprocess.run([sys.executable, str(auto_script)], check=True)
            logger.info("[Stage 9] Automation script finished successfully.")
        except Exception as e:
            logger.error(f"[Stage 9] Automation script failed: {e}")

    return {
        "records":        all_records,
        "change_summary": change_summary,
        "json_path":      json_path,
        "csv_path":       csv_path,
        "download_summary": download_summary,
    }


# —————————————————————————————————————————————————————————————————————————————
#  CLI ENTRY POINT
# —————————————————————————————————————————————————————————————————————————————

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Glacier Data Collection Pipeline — India")
    parser.add_argument(
        "--region",
        choices=list(REGIONS.keys()),
        default="all",
        help="Glacier region to collect data for.",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of past days to search for satellite imagery.",
    )
    parser.add_argument(
        "--download-images",
        action="store_true",
        help="Download actual image files into raw_data/ (default: metadata only).",
    )
    parser.add_argument(
        "--max-downloads",
        type=int,
        default=20,
        help="Maximum number of files to download in one run (0 = all).",
    )
    parser.add_argument(
        "--download-source",
        choices=["both", "copernicus", "nasa"],
        default="both",
        help="Choose which source to download from during Stage 4.",
    )
    parser.add_argument(
        "--satellites",
        type=str,
        default="s1,s2",
        help="Comma-separated satellites to ingest (default: s1,s2).",
    )
    parser.add_argument(
        "--s1-product-type",
        type=str,
        default="GRD",
        help="Sentinel-1 productType filter for CDSE search (default: GRD).",
    )
    parser.add_argument(
        "--sentinel-only",
        action="store_true",
        help="Skip GLIMS + NASA sources; ingest Sentinel only.",
    )
    parser.add_argument(
        "--realtime",
        action="store_true",
        help="Run in realtime polling mode until Ctrl+C.",
    )
    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=900,
        help="Polling interval for --realtime (default: 900).",
    )
    args = parser.parse_args()
    run_pipeline(
        region_key=args.region,
        days_back=args.days,
        download_images=args.download_images,
        max_downloads=args.max_downloads,
        download_source=args.download_source,
        satellites=args.satellites,
        sentinel_only=args.sentinel_only,
        realtime=args.realtime,
        poll_seconds=args.poll_seconds,
        s1_product_type=args.s1_product_type,
    )
