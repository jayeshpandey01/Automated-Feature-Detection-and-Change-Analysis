import os
import sys
import pickle
import logging
import requests
import argparse
import pandas as pd
from datetime import datetime, timedelta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("HazardPredictor")

# Paths
MODEL_PATH = "data_prediction/models/hazard_prediction_model.pkl"

def load_trained_model():
    if not os.path.exists(MODEL_PATH):
        logger.error(f"Trained model not found at {MODEL_PATH}. Please run train.py first.")
        sys.exit(1)
    with open(MODEL_PATH, "rb") as f:
        return pickle.load(f)

def fetch_forecast_features(lat, lon):
    """
    Fetches the 7-day forecast from Open-Meteo and compiles features.
    """
    logger.info(f"Fetching 7-day meteorological forecast for [{lat}, {lon}]...")
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "precipitation_sum,temperature_2m_mean",
        "timezone": "GMT"
    }
    
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        daily = resp.json().get("daily", {})
        
        dates = daily.get("time", [])
        precip = daily.get("precipitation_sum", [])
        temp = daily.get("temperature_2m_mean", [])
        
        df = pd.DataFrame({
            "date": dates,
            "precipitation_24h_mm": [p if p is not None else 0.0 for p in precip],
            "temp_mean_c": [t if t is not None else 0.0 for t in temp]
        })
        
        # Calculate 72h accumulated precipitation (rolling 3-day sum)
        df["precipitation_72h_mm"] = df["precipitation_24h_mm"].rolling(window=3, min_periods=1).sum()
        
        # Calculate 5-day temperature delta
        # Since forecast is only 7 days, we use backward diff or fill with diff from start
        df["temp_delta_5d"] = df["temp_mean_c"].diff(periods=5).fillna(0.0)
        
        return df
    except Exception as e:
        logger.error(f"Failed to fetch forecast: {e}")
        return None

def predict_hazard(lat, lon, slope_angle):
    model = load_trained_model()
    
    # 1. Fetch real-time forecast data
    df_features = fetch_forecast_features(lat, lon)
    if df_features is None:
        logger.error("Could not compile features. Prediction aborted.")
        return
        
    # 2. Add topographic slope angle
    df_features["slope_angle_deg"] = float(slope_angle)
    
    # 3. Align features order to model expectations
    feature_cols = [
        "precipitation_24h_mm",
        "temp_mean_c",
        "precipitation_72h_mm",
        "temp_delta_5d",
        "slope_angle_deg"
    ]
    X = df_features[feature_cols]
    
    # 4. Predict probabilities using XGBoost/best model
    logger.info("Running hazard classification inference...")
    probs = model.predict_proba(X)[:, 1] # Probability of Class 1 (Disaster)
    preds = model.predict(X)
    
    df_features["hazard_probability"] = probs
    df_features["hazard_prediction"] = preds
    
    # Map probability to qualitative risk levels
    risk_levels = []
    for p in probs:
        if p < 0.2: risk_levels.append("Low")
        elif p < 0.5: risk_levels.append("Medium")
        elif p < 0.8: risk_levels.append("High")
        else: risk_levels.append("Critical")
    df_features["risk_level"] = risk_levels
    
    # 5. Output predictions
    print("\n" + "="*60)
    print(f" HAZARD PREDICTIONS FOR COORDINATES: [{lat}, {lon}] (Slope: {slope_angle}°)")
    print("="*60)
    for _, row in df_features.iterrows():
        print(f"Date: {row['date']} | Temp: {row['temp_mean_c']:5.1f}°C | Rain: {row['precipitation_24h_mm']:4.1f}mm | 72h Rain: {row['precipitation_72h_mm']:4.1f}mm | Risk: {row['risk_level']:8} (Prob: {row['hazard_probability']*100:5.1f}%)")
    print("="*60 + "\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Predict glacier/landslide hazard risk using the trained model.")
    parser.add_argument("--lat", type=float, default=30.735, help="Latitude coordinate (default: Kedarnath 30.735)")
    parser.add_argument("--lon", type=float, default=79.066, help="Longitude coordinate (default: Kedarnath 79.066)")
    parser.add_argument("--slope", type=float, default=35.0, help="Local terrain slope angle in degrees (default: 35.0)")
    
    args = parser.parse_args()
    predict_hazard(args.lat, args.lon, args.slope)
