import os
import sys
import json
import pickle
import logging
import requests
from datetime import datetime, timedelta
import pandas as pd
from pymongo import MongoClient, UpdateOne

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("HistoricalRangePredictor")

# Configuration
MODEL_PATH = "data_prediction/models/hazard_prediction_model.pkl"
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "prediction_db"
PRED_COL = "hazard_predictions"

TARGET_GRIDS = [
    {"name": "Kedarnath Grid", "latitude": 30.735, "longitude": 79.066, "slope": 35.0},
    {"name": "Chamoli Grid", "latitude": 30.485, "longitude": 79.733, "slope": 42.5},
    {"name": "Dharali Grid", "latitude": 31.031, "longitude": 78.784, "slope": 38.0}
]

def load_model():
    if not os.path.exists(MODEL_PATH):
        logger.error(f"Trained model not found at {MODEL_PATH}. Please train it first.")
        sys.exit(1)
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)

def fetch_weather_range(lat, lon, start_date, end_date):
    logger.info(f"Querying weather archive for [{lat}, {lon}] from {start_date} to {end_date}...")
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "daily": "precipitation_sum,temperature_2m_mean",
        "timezone": "GMT"
    }
    
    try:
        resp = requests.get(url, params=params, timeout=20)
        resp.raise_for_status()
        daily = resp.json().get("daily", {})
        
        df = pd.DataFrame({
            "date": daily.get("time", []),
            "precipitation_24h_mm": [p if p is not None else 0.0 for p in daily.get("precipitation_sum", [])],
            "temp_mean_c": [t if t is not None else 0.0 for t in daily.get("temperature_2m_mean", [])]
        })
        
        df["precipitation_72h_mm"] = df["precipitation_24h_mm"].rolling(window=3, min_periods=1).sum()
        df["temp_delta_5d"] = df["temp_mean_c"].diff(periods=5).fillna(0.0)
        return df
    except Exception as e:
        logger.error(f"Failed to query Open-Meteo Archive API: {e}")
        return None

def main():
    model = load_model()
    
    # Range is Jan 1st, 2026 to today (June 27, 2026)
    start_date = "2026-01-01"
    end_date = "2026-06-27"
    
    all_predictions = []
    
    for grid in TARGET_GRIDS:
        logger.info(f"=== Processing Grid: {grid['name']} ===")
        df_weather = fetch_weather_range(grid["latitude"], grid["longitude"], start_date, end_date)
        if df_weather is None or df_weather.empty:
            continue
            
        df_weather["slope_angle_deg"] = float(grid["slope"])
        
        feature_cols = [
            "precipitation_24h_mm",
            "temp_mean_c",
            "precipitation_72h_mm",
            "temp_delta_5d",
            "slope_angle_deg"
        ]
        X = df_weather[feature_cols]
        
        logger.info("Executing XGBoost predictions...")
        probs = model.predict_proba(X)[:, 1]
        
        for idx, row in df_weather.iterrows():
            prob = float(probs[idx])
            
            # Map probability to risk level
            if prob < 0.2: risk = "Low"
            elif prob < 0.5: risk = "Medium"
            elif prob < 0.8: risk = "High"
            else: risk = "Critical"
            
            all_predictions.append({
                "latitude": float(grid["latitude"]),
                "longitude": float(grid["longitude"]),
                "grid_name": grid["name"],
                "date": row["date"],
                "precipitation_24h_mm": float(row["precipitation_24h_mm"]),
                "precipitation_72h_mm": float(row["precipitation_72h_mm"]),
                "temp_mean_c": float(row["temp_mean_c"]),
                "slope_angle_deg": float(grid["slope"]),
                "hazard_probability": prob,
                "risk_level": risk
            })
            
    if all_predictions:
        logger.info(f"Upserting {len(all_predictions)} daily predictions to MongoDB...")
        try:
            client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
            db = client[DB_NAME]
            col = db[PRED_COL]
            col.create_index([("latitude", 1), ("longitude", 1), ("date", 1)], unique=True)
            
            ops = [
                UpdateOne(
                    {
                        "latitude": p["latitude"],
                        "longitude": p["longitude"],
                        "date": p["date"]
                    },
                    {"$set": p},
                    upsert=True
                )
                for p in all_predictions
            ]
            result = col.bulk_write(ops)
            logger.info(f"Successfully upserted {result.upserted_count + result.modified_count} predictions in '{DB_NAME}.{PRED_COL}'.")
            client.close()
        except Exception as e:
            logger.error(f"Failed to save predictions to database: {e}")
            
    logger.info("Historical range prediction process completed.")

if __name__ == "__main__":
    main()
