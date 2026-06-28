import os
import sys
import json
import logging
import requests
from datetime import datetime, timedelta
from pymongo import MongoClient, UpdateOne

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("DataHarvester")

# Configuration
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "prediction_db"
WEATHER_COL = "meteorological_history"
EVENT_COL = "hazard_events"

# Define Historical Disaster Events
HISTORICAL_EVENTS = [
    {
        "event_id": "evt_kedarnath_2013",
        "name": "Kedarnath GLOF & Flash Floods",
        "date": "2013-06-16",
        "latitude": 30.735,
        "longitude": 79.066,
        "type": "GLOF/Flash Flood",
        "severity": "Critical"
    },
    {
        "event_id": "evt_chamoli_2021",
        "name": "Chamoli Rock & Ice Avalanche",
        "date": "2021-02-07",
        "latitude": 30.485,
        "longitude": 79.733,
        "type": "Ice Avalanche/Landslide",
        "severity": "Critical"
    },
    {
        "event_id": "evt_dharali_2025",
        "name": "Dharali Cloudburst & Mudflow",
        "date": "2025-08-05",
        "latitude": 31.031,
        "longitude": 78.784,
        "type": "Landslide/Mudflow",
        "severity": "Critical"
    }
]

def harvest_weather(lat, lon, start_date, end_date):
    """
    Queries the Open-Meteo Historical Archive API to fetch daily precipitation and temperature.
    """
    logger.info(f"Querying Open-Meteo weather for [{lat}, {lon}] from {start_date} to {end_date}...")
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
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        daily = data.get("daily", {})
        
        dates = daily.get("time", [])
        precip = daily.get("precipitation_sum", [])
        temp = daily.get("temperature_2m_mean", [])
        
        records = []
        for d, p, t in zip(dates, precip, temp):
            records.append({
                "grid_id": f"grid_{round(lat, 2)}_{round(lon, 2)}",
                "latitude": lat,
                "longitude": lon,
                "date": d,
                "precipitation_24h_mm": p if p is not None else 0.0,
                "temp_mean_c": t if t is not None else 0.0,
                "fetched_at": datetime.utcnow().isoformat()
            })
        return records
    except Exception as e:
        logger.error(f"Failed to query Open-Meteo Archive API: {e}")
        return []

def main():
    # 1. Save historical disaster events metadata locally
    logger.info("Saving historical hazard events catalog locally...")
    events_output_path = "data_prediction/raw/weather/hazard_events.json"
    os.makedirs(os.path.dirname(events_output_path), exist_ok=True)
    with open(events_output_path, "w", encoding="utf-8") as f:
        json.dump(HISTORICAL_EVENTS, f, indent=2, default=str)
    logger.info(f"Hazard events catalog saved locally to {events_output_path}")
    
    # 2. Harvest weather data in a +/- 20 days window around each event
    all_weather_records = []
    for ev in HISTORICAL_EVENTS:
        event_date = datetime.strptime(ev["date"], "%Y-%m-%d")
        start_date = (event_date - timedelta(days=20)).strftime("%Y-%m-%d")
        end_date = (event_date + timedelta(days=20)).strftime("%Y-%m-%d")
        
        logger.info(f"Processing event '{ev['name']}' (Window: {start_date} to {end_date})")
        records = harvest_weather(ev["latitude"], ev["longitude"], start_date, end_date)
        all_weather_records.extend(records)
        
    # 3. Harvest some baseline negative sample weather data for same grids during safe periods
    # (e.g. baseline periods: summer 2018 where no disaster occurred in these grids)
    baseline_grids = [(ev["latitude"], ev["longitude"]) for ev in HISTORICAL_EVENTS]
    for lat, lon in baseline_grids:
        logger.info(f"Harvesting baseline weather records for [{lat}, {lon}] (Safe window: 2018-06-01 to 2018-07-15)")
        records = harvest_weather(lat, lon, "2018-06-01", "2018-07-15")
        all_weather_records.extend(records)
        
    # 4. Save weather records locally as JSON
    if all_weather_records:
        weather_output_path = "data_prediction/raw/weather/historical_weather_data.json"
        with open(weather_output_path, "w", encoding="utf-8") as f:
            json.dump(all_weather_records, f, indent=2, default=str)
        logger.info(f"Weather dataset saved locally to {weather_output_path}")
        
    logger.info("Weather and Hazard Events Harvesting Completed successfully (Local files only).")

if __name__ == "__main__":
    main()
