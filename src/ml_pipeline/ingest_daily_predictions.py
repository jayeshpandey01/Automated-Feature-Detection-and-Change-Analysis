"""
ingest_daily_predictions.py
===========================
Full pipeline script:
  1. Clears all existing records in prediction_db.hazard_predictions
  2. Fetches weather archive (Jan 1, 2026 → today) from Open-Meteo for target grids
  3. Computes rolling features and runs inference via the trained XGBoost model
  4. Generates one AI hazard summary per grid using local Ollama llama3.2:1b
  5. Stores all results (with AI summary) into MongoDB prediction_db.hazard_predictions

Run:
    python src/ml_pipeline/ingest_daily_predictions.py
"""

import os
import sys
import pickle
import logging
import requests
from datetime import datetime, date, timedelta
import pandas as pd
from pymongo import MongoClient

# Force UTF-8 for Windows console
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("IngestDailyPredictions")

# ── Configuration ────────────────────────────────────────────────
MODEL_PATH = "data_prediction/models/hazard_prediction_model.pkl"
MONGO_URI  = "mongodb://localhost:27017/"
DB_NAME    = "prediction_db"
PRED_COL   = "hazard_predictions"

START_DATE = "2026-01-01"
# Archive API lags 1-2 days behind — use yesterday to avoid 400 errors
END_DATE   = (date.today() - timedelta(days=2)).strftime("%Y-%m-%d")

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3.2:1b"
OLLAMA_TIMEOUT = 120  # seconds (CPU inference can be slow)

TARGET_GRIDS = [
    {"name": "Kedarnath Grid", "latitude": 30.735, "longitude": 79.066, "slope": 35.0},
    {"name": "Chamoli Grid",   "latitude": 30.485, "longitude": 79.733, "slope": 42.5},
    {"name": "Dharali Grid",   "latitude": 31.031, "longitude": 78.784, "slope": 38.0},
]

FEATURE_COLS = [
    "precipitation_24h_mm",
    "temp_mean_c",
    "precipitation_72h_mm",
    "temp_delta_5d",
    "slope_angle_deg",
]

# ── Helpers ──────────────────────────────────────────────────────

def load_model():
    if not os.path.exists(MODEL_PATH):
        logger.error(f"Model not found at '{MODEL_PATH}'. Please run train.py first.")
        sys.exit(1)
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
    logger.info("XGBoost model loaded successfully.")
    return model


def fetch_weather(lat, lon, start, end):
    """Fetch daily archive weather from Open-Meteo for a coordinate range."""
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start,
        "end_date": end,
        "daily": "precipitation_sum,temperature_2m_mean",
        "timezone": "GMT",
    }
    logger.info(f"  Fetching weather [{lat}, {lon}]  {start} → {end}")
    try:
        resp = requests.get(url, params=params, timeout=20)
        resp.raise_for_status()
        daily = resp.json().get("daily", {})
        df = pd.DataFrame({
            "date": daily.get("time", []),
            "precipitation_24h_mm": [p or 0.0 for p in daily.get("precipitation_sum", [])],
            "temp_mean_c":          [t or 0.0 for t in daily.get("temperature_2m_mean", [])],
        })
        df["precipitation_72h_mm"] = df["precipitation_24h_mm"].rolling(window=3, min_periods=1).sum()
        df["temp_delta_5d"]        = df["temp_mean_c"].diff(periods=5).fillna(0.0)
        logger.info(f"  → {len(df)} days of weather data received.")
        return df
    except Exception as e:
        logger.error(f"  Weather fetch failed: {e}")
        return None


def classify_risk(prob):
    if prob < 0.2:  return "Low"
    if prob < 0.5:  return "Medium"
    if prob < 0.8:  return "High"
    return "Critical"


def generate_ai_summary(grid, predictions, max_risk):
    """Call local Ollama llama3.2:1b to produce a 2-sentence hazard summary for this grid."""
    sample_precip = [f'{p["precipitation_24h_mm"]:.1f}mm' for p in predictions[:3]]
    sample_temp   = [f'{p["temp_mean_c"]:.1f}C'           for p in predictions[:3]]

    prompt = (
        f"Write a short, professional, 2-sentence summary of the following environmental report: "
        f"Location: {grid['name']} at coordinates [{grid['latitude']}, {grid['longitude']}]. "
        f"Slope angle: {grid['slope']} degrees. "
        f"Period: {START_DATE} to {END_DATE} ({len(predictions)} days). "
        f"Sample temperatures: {', '.join(sample_temp)}. "
        f"Sample precipitation: {', '.join(sample_precip)}. "
        f"The overall hazard risk level during this period peaked at '{max_risk}'. "
        f"Summarize the seasonal conditions and state the peak risk level clearly."
    )
    logger.info(f"  Generating AI summary via Ollama ({OLLAMA_MODEL})...")
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=OLLAMA_TIMEOUT,
        )
        if resp.status_code == 200:
            summary = resp.json().get("response", "").strip()
            logger.info(f"  AI summary generated ({len(summary)} chars).")
            return summary
        else:
            logger.warning(f"  Ollama returned HTTP {resp.status_code}.")
    except Exception as e:
        logger.warning(f"  Ollama call failed: {e}")
    return "AI summary unavailable."


def clear_collection(col):
    result = col.delete_many({})
    logger.info(f"Cleared {result.deleted_count} existing records from '{DB_NAME}.{PRED_COL}'.")


# ── Main ─────────────────────────────────────────────────────────

def main():
    logger.info("=" * 60)
    logger.info("  GlacioWatch — Daily Prediction Ingestion Pipeline")
    logger.info(f"  Date range : {START_DATE} → {END_DATE}")
    logger.info(f"  Grids      : {len(TARGET_GRIDS)}")
    logger.info("=" * 60)

    # 1. Load model
    model = load_model()

    # 2. Connect to MongoDB and clear old data
    logger.info("\n[Step 1] Connecting to MongoDB...")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.server_info()
        db  = client[DB_NAME]
        col = db[PRED_COL]
        logger.info("  Connected to MongoDB.")
    except Exception as e:
        logger.error(f"  MongoDB connection failed: {e}")
        sys.exit(1)

    logger.info("\n[Step 2] Clearing existing predictions...")
    clear_collection(col)

    # 3. Process each grid
    all_docs = []

    for grid in TARGET_GRIDS:
        logger.info(f"\n[Step 3] Processing grid: {grid['name']}")

        # a) Fetch weather archive
        df = fetch_weather(grid["latitude"], grid["longitude"], START_DATE, END_DATE)
        if df is None or df.empty:
            logger.warning(f"  Skipping {grid['name']} — no weather data.")
            continue

        # b) Add slope feature and run inference
        df["slope_angle_deg"] = float(grid["slope"])
        probs = model.predict_proba(df[FEATURE_COLS])[:, 1]

        # c) Build prediction records
        grid_docs = []
        max_risk_rank = 0
        risk_order = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
        max_risk = "Low"

        for idx, row in df.iterrows():
            prob = float(probs[idx])
            risk = classify_risk(prob)
            if risk_order[risk] > risk_order[max_risk]:
                max_risk = risk
            grid_docs.append({
                "grid_name":            grid["name"],
                "latitude":             float(grid["latitude"]),
                "longitude":            float(grid["longitude"]),
                "slope_angle_deg":      float(grid["slope"]),
                "date":                 row["date"],
                "precipitation_24h_mm": float(row["precipitation_24h_mm"]),
                "precipitation_72h_mm": float(row["precipitation_72h_mm"]),
                "temp_mean_c":          float(row["temp_mean_c"]),
                "hazard_probability":   prob,
                "risk_level":           risk,
                "ai_summary":           None,  # filled below
                "ingested_at":          datetime.utcnow().isoformat(),
            })

        logger.info(f"  {len(grid_docs)} predictions classified. Peak risk: {max_risk}")

        # d) Generate one AI summary for this grid's full period
        ai_summary = generate_ai_summary(grid, grid_docs, max_risk)
        for doc in grid_docs:
            doc["ai_summary"] = ai_summary

        all_docs.extend(grid_docs)

    # 4. Insert into MongoDB
    if all_docs:
        logger.info(f"\n[Step 4] Inserting {len(all_docs)} documents into MongoDB...")
        try:
            # Create compound index for deduplication
            col.create_index(
                [("latitude", 1), ("longitude", 1), ("date", 1)],
                unique=True,
                background=True
            )
            result = col.insert_many(all_docs, ordered=False)
            logger.info(f"  ✅ Inserted {len(result.inserted_ids)} documents into '{DB_NAME}.{PRED_COL}'.")
        except Exception as e:
            logger.error(f"  Insert failed: {e}")
    else:
        logger.warning("No predictions generated — nothing to insert.")

    client.close()
    logger.info("Ingestion pipeline completed successfully.")
    logger.info(f"Total records in DB: collection '{PRED_COL}' now has {len(all_docs)} documents.")


if __name__ == "__main__":
    main()
