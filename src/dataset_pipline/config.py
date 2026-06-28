"""
Glacier Pipeline Configuration
"""
import os
from pathlib import Path

# Load .env if python-dotenv is available
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).parent.parent / "backend" / ".env"
    load_dotenv(dotenv_path=_env_path, override=False)
except ImportError:
    pass

# MongoDB Settings — read from environment, fallback to local defaults
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = os.environ.get("DB_NAME", "glacier_india_db")

COLLECTION_RAW = "glaciers_raw"
COLLECTION_PROCESSED = "glaciers_processed"
COLLECTION_LOGS = "pipeline_logs"

# Data Sources
DATA_SOURCES = {
    "SAC_ISRO": {
        "name": "Space Applications Centre (ISRO) - Himalayan Glacier Inventory",
        "url": "https://cryosphere.sac.gov.in/glacier",
        "description": "ISRO SAC glacier inventory for Indian Himalayas"
    },
    "GLIMS": {
        "name": "Global Land Ice Measurements from Space",
        "url": "https://www.glims.org/download/",
        "api": "https://www.glims.org/api/glacier.kml?l=3&lon_w=68&lon_e=98&lat_s=26&lat_n=36",
        "description": "GLIMS glacier database filtered for India region"
    },
    "RGI": {
        "name": "Randolph Glacier Inventory",
        "url": "https://www.glims.org/RGI/",
        "regions": ["13", "14", "15"],  # Central Asia, South Asia West/East
        "description": "RGI regions covering Indian Himalayan glaciers"
    },
    "WGMS": {
        "name": "World Glacier Monitoring Service",
        "url": "https://wgms.ch/data/",
        "description": "Mass balance and fluctuation data"
    }
}

# India Bounding Box (for filtering)
INDIA_BOUNDS = {
    "lat_min": 27.0,
    "lat_max": 36.5,
    "lon_min": 68.0,
    "lon_max": 98.0
}

# Key Indian Glacier Regions
GLACIER_REGIONS = [
    "Karakoram",
    "Ladakh",
    "Zanskar",
    "Spiti",
    "Lahaul",
    "Garhwal",
    "Kumaon",
    "Sikkim",
    "Arunachal Pradesh"
]

# Output Paths
OUTPUT_DIR = "output"
LOG_DIR = "logs"
RAW_DATA_DIR = "data/raw"
PROCESSED_DATA_DIR = "data/processed"

# Pipeline Settings
MAX_RETRIES = 3
REQUEST_TIMEOUT = 30
DATA_VERSION_KEY = "data_version"
