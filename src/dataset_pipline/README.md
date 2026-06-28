# 🏔 India Glacier Monitoring Pipeline

Automated data pipeline that collects, stores, and exports glacier data
for all major Indian Himalayan glaciers — ready to plot on a map.

---

## Architecture

```
Run pipeline.py
     │
     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 1: Check MongoDB                              │
│    → Data fresh? (< 24h old)                        │
│       YES → Load from DB, skip download             │
│       NO  → Trigger download                        │
└────────────────────┬────────────────────────────────┘
                     │ (if download needed)
                     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 2: Download from Sources                      │
│    • Curated Inventory (30 major glaciers, offline) │
│    • GLIMS API (Global glacier database)            │
│    • WGMS India (Mass balance data)                 │
│    • RGI Catalog (Randolph inventory)               │
└────────────────────┬────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 3: Store RAW data → MongoDB (glaciers_raw)    │
└────────────────────┬────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 4: Process & Enrich                           │
│    • Validate coordinates (India bounding box)      │
│    • Deduplicate (by name + spatial proximity)      │
│    • Enrich: GeoJSON, map colors, marker sizes      │
│    • Sort by area                                   │
└────────────────────┬────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 5: Delete old processed data from MongoDB     │
│  STEP 6: Store NEW processed data → glaciers_processed │
└────────────────────┬────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 7: Export JSON files (output/)                │
│    • glaciers_india_TIMESTAMP.json   (full)         │
│    • glaciers_india_geojson_*.json   (GeoJSON)      │
│    • glacier_map_points_*.json       (lightweight)  │
│    • glacier_stats_*.json            (summary)      │
│    • latest_*.json                   (symlinks)     │
└────────────────────┬────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────┐
│  STEP 8: Clean old raw data (keep latest)           │
│  STEP 9: Write run log → logs/run_*.json            │
└─────────────────────────────────────────────────────┘
```

---

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Start MongoDB (local)
mongod --dbpath ./data/db

# Run once
python pipeline.py

# Force re-download
python pipeline.py --force

# Run on a schedule (every 24h)
python scheduler.py

# Run every 6 hours
python scheduler.py --interval 6
```

---

## MongoDB Collections

| Collection           | Contents                              |
|---------------------|---------------------------------------|
| `glaciers_raw`       | Raw downloaded records per source     |
| `glaciers_processed` | Enriched, deduplicated, map-ready     |
| `pipeline_logs`      | All events: download, store, errors   |

---

## Output Files

| File                              | Use case                      |
|-----------------------------------|-------------------------------|
| `latest_full_dataset.json`        | Complete data, all fields      |
| `latest_geojson.json`             | Load into Leaflet/Mapbox/QGIS  |
| `latest_map_points.json`          | Lightweight frontend markers   |
| `latest_stats.json`               | Statistics dashboard           |

---

## Data Sources

| Source             | Coverage                          | Notes                    |
|-------------------|-----------------------------------|--------------------------|
| Curated Inventory | 30 major Indian glaciers          | Verified coords, offline |
| GLIMS             | Global glacier outlines           | API required             |
| WGMS              | Mass balance, fluctuation data    | API required             |
| RGI               | Randolph Glacier Inventory        | Academic catalog         |

---

## Glacier Regions Covered

- **Karakoram** – Siachen, Biafo, Baltoro, Hispar, Rimo
- **Ladakh / Zanskar** – Drang-Drung, Parkachik, Pensilungpa
- **Himachal Pradesh** – Bara Shigri, Chhota Shigri, Samudra Tapu
- **Uttarakhand** – Gangotri, Milam, Pindari, Satopanth, Chorabari
- **Sikkim** – Zemu, Kangchenjunga, Lhonak, South Lhonak
- **Arunachal Pradesh** – Kangto, Gorichen

---

## Map Integration

The `latest_geojson.json` file is directly loadable in:
- **Leaflet.js**: `L.geoJSON(data).addTo(map)`
- **Mapbox GL**: `map.addSource('glaciers', {type:'geojson', data: ...})`
- **QGIS**: File → Add Layer → Add Vector Layer
- **Google Maps**: Parse features and add markers

Each feature includes `map.color`, `map.marker_size`, and popup fields.
