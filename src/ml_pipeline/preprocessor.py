import os
import sys
import json
import logging
import pandas as pd
from datetime import datetime, timedelta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("DataPreprocessor")

# Paths
WEATHER_INPUT = "data_prediction/raw/weather/historical_weather_data.json"
EVENTS_INPUT = "data_prediction/raw/weather/hazard_events.json"
DATASET_OUTPUT = "data_prediction/processed/tabular/dataset.csv"

def load_json_file(path):
    if not os.path.exists(path):
        logger.error(f"Input file not found: {path}")
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def preprocess():
    logger.info("Step 1: Loading raw dataset files...")
    weather_data = load_json_file(WEATHER_INPUT)
    events_data = load_json_file(EVENTS_INPUT)
    
    if not weather_data or not events_data:
        logger.error("Failed to load required input files.")
        return
        
    df_weather = pd.DataFrame(weather_data)
    df_events = pd.DataFrame(events_data)
    
    logger.info(f"Loaded {len(df_weather)} weather records and {len(df_events)} events.")
    
    # Sort weather records chronologically within each grid to compute rolling sums
    df_weather = df_weather.sort_values(by=["latitude", "longitude", "date"]).reset_index(drop=True)
    
    logger.info("Step 2: Calculating rolling weather indicators...")
    # Calculate 3-day (72h) accumulated precipitation rolling sum
    df_weather["precipitation_72h_mm"] = df_weather.groupby(["latitude", "longitude"])["precipitation_24h_mm"].transform(
        lambda x: x.rolling(window=3, min_periods=1).sum()
    )
    
    # Calculate 5-day temperature delta (anomaly trend)
    df_weather["temp_delta_5d"] = df_weather.groupby(["latitude", "longitude"])["temp_mean_c"].transform(
        lambda x: x.diff(periods=5).fillna(0.0)
    )
    
    logger.info("Step 3: Engineering target disaster labels (1 = Hazard, 0 = Safe)...")
    # Build a lookup set of (latitude, longitude, date) where events occurred
    # We round lat/lon to 2 decimal places to ensure grid matching
    event_lookup = set()
    for _, ev in df_events.iterrows():
        lat_r = round(ev["latitude"], 2)
        lon_r = round(ev["longitude"], 2)
        event_lookup.add((lat_r, lon_r, ev["date"]))
        
    labels = []
    event_types = []
    for _, row in df_weather.iterrows():
        lat_r = round(row["latitude"], 2)
        lon_r = round(row["longitude"], 2)
        key = (lat_r, lon_r, row["date"])
        
        if key in event_lookup:
            labels.append(1)
            # Find the type of disaster for this coordinate
            matching_ev = df_events[
                (df_events["latitude"].round(2) == lat_r) & 
                (df_events["longitude"].round(2) == lon_r) & 
                (df_events["date"] == row["date"])
            ]
            event_type = matching_ev.iloc[0]["type"] if not matching_ev.empty else "Hazard"
            event_types.append(event_type)
        else:
            labels.append(0)
            event_types.append("None")
            
    df_weather["hazard_label"] = labels
    df_weather["hazard_type"] = event_types
    
    # Add engineered topography features (Simulated slope angles for high-risk zones)
    # Steepness: Kedarnath (~35°), Chamoli (~42°), Dharali (~38°), baseline/valleys (~12°)
    logger.info("Step 4: Merging topographic features...")
    slopes = []
    for _, row in df_weather.iterrows():
        lat_r = round(row["latitude"], 2)
        if lat_r == 30.74:    # Kedarnath
            slopes.append(35.2)
        elif lat_r == 30.49:  # Chamoli
            slopes.append(42.5)
        elif lat_r == 31.03:  # Dharali
            slopes.append(38.0)
        else:
            slopes.append(12.4) # Default/baseline valley slope
            
    df_weather["slope_angle_deg"] = slopes
    
    logger.info(f"Step 5: Exporting processed dataset to {DATASET_OUTPUT}...")
    os.makedirs(os.path.dirname(DATASET_OUTPUT), exist_ok=True)
    df_weather.to_csv(DATASET_OUTPUT, index=False)
    
    # Print summary statistics of compiled dataset
    logger.info("=== Preprocessed Tabular Dataset Summary ===")
    logger.info(f"Total compiled samples: {len(df_weather)}")
    logger.info(f"Disaster events (Class 1): {df_weather['hazard_label'].sum()}")
    logger.info(f"Safe baselines (Class 0): {len(df_weather) - df_weather['hazard_label'].sum()}")
    logger.info("Pipeline preprocessor run complete.")

if __name__ == "__main__":
    preprocess()
