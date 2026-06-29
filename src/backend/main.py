from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
import json
import pickle
import requests
import random
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta

# Load .env from this file's directory (src/backend/.env)
try:
    from dotenv import load_dotenv
    _env_path = Path(__file__).parent / ".env"
    load_dotenv(dotenv_path=_env_path, override=False)
    print(f"[ENV] Loaded environment from: {_env_path}")
except ImportError:
    print("[ENV] python-dotenv not installed — skipping .env load. Run: pip install python-dotenv")


sys.path.append(str(Path(__file__).parent.parent / "dataset_pipline"))
from db_manager import DatabaseManager
from config import MONGODB_URI, DB_NAME
from processor import GlacierProcessor
from fastapi.responses import Response

# Import auth and email services
sys.path.append(str(Path(__file__).parent))
from firebase_auth import firebase_auth_manager
from email_service import send_otp_email, send_alert_email

app = FastAPI(title="GlacioWatch API")

# Enable CORS for React Native and Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DatabaseManager(MONGODB_URI, DB_NAME)
processor_engine = GlacierProcessor()

# Authentication Request models
class SendOTPRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class FirebaseLoginRequest(BaseModel):
    token: str

class SubscriptionRequest(BaseModel):
    email: str
    subscribed: bool

class TriggerAlertsRequest(BaseModel):
    glacier_id: str
    risk_level: str


class DailyPredictionRequest(BaseModel):
    latitude: float
    longitude: float
    slope_angle_deg: float

@app.get("/")
def read_root():
    return {"message": "Welcome to GlacioWatch API", "status": "online"}

@app.post("/api/auth/send-otp")
def send_otp(req: SendOTPRequest):
    """Generates a 6-digit OTP, stores it in MongoDB with expiry, and emails the user."""
    if not db.is_connected():
        raise HTTPException(status_code=500, detail="Database not connected")
    
    # Generate 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    expiry = datetime.utcnow() + timedelta(minutes=10)
    
    # Save OTP to database
    db.db["otps"].update_one(
        {"email": req.email},
        {"$set": {"otp": otp, "expires_at": expiry}},
        upsert=True
    )
    
    # Send email (using mock file fallback if SMTP is unconfigured)
    sent = send_otp_email(req.email, otp)
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to dispatch OTP email")
        
    return {"success": True, "message": "OTP sent successfully"}

@app.post("/api/auth/verify-otp")
def verify_otp(req: VerifyOTPRequest):
    """Verifies the OTP and signs the user in / registers the user."""
    if not db.is_connected():
        raise HTTPException(status_code=500, detail="Database not connected")
        
    otp_record = db.db["otps"].find_one({"email": req.email})
    if not otp_record:
        raise HTTPException(status_code=400, detail="No OTP record found for this email")
        
    if datetime.utcnow() > otp_record["expires_at"]:
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    if otp_record["otp"] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
        
    # Valid OTP! Let's delete the OTP record
    db.db["otps"].delete_one({"email": req.email})
    
    # Create or update user in users collection
    user = db.db["users"].find_one({"email": req.email})
    if not user:
        new_user = {
            "email": req.email,
            "uid": f"otp-user-{int(os.urandom(4).hex(), 16)}",
            "created_at": datetime.utcnow(),
            "subscribed": True, # subscribe by default
        }
        db.db["users"].insert_one(new_user)
        user = new_user
    
    # Remove MongoDB internal _id before returning
    if "_id" in user:
        del user["_id"]
        
    return {"success": True, "user": user}

@app.post("/api/auth/firebase-login")
def firebase_login(req: FirebaseLoginRequest):
    """Verifies a Firebase ID token and provisions a local user session."""
    if not db.is_connected():
        raise HTTPException(status_code=500, detail="Database not connected")
        
    try:
        decoded_token = firebase_auth_manager.verify_token(req.token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Unauthorized/Invalid Firebase ID Token: {e}")
        
    email = decoded_token.get("email")
    uid = decoded_token.get("uid")
    name = decoded_token.get("name", email.split("@")[0].capitalize())
    
    if not email:
        raise HTTPException(status_code=400, detail="Firebase token does not contain an email address")
        
    user = db.db["users"].find_one({"email": email})
    if not user:
        new_user = {
            "email": email,
            "uid": uid,
            "name": name,
            "created_at": datetime.utcnow(),
            "subscribed": True,
        }
        db.db["users"].insert_one(new_user)
        user = new_user
    else:
        # Update user info if needed
        db.db["users"].update_one(
            {"email": email},
            {"$set": {"uid": uid, "name": name}}
        )
        user["uid"] = uid
        user["name"] = name
        
    if "_id" in user:
        del user["_id"]
        
    return {"success": True, "user": user}

@app.post("/api/auth/notifications/subscribe")
def subscribe_notifications(req: SubscriptionRequest):
    """Enables or disables glacier alerts notifications for a user."""
    if not db.is_connected():
        raise HTTPException(status_code=500, detail="Database not connected")
        
    result = db.db["users"].update_one(
        {"email": req.email},
        {"$set": {"subscribed": req.subscribed}}
    )
    
    if result.matched_count == 0:
        # If user does not exist in collection yet, create a minimalist profile
        db.db["users"].insert_one({
            "email": req.email,
            "subscribed": req.subscribed,
            "created_at": datetime.utcnow()
        })
        
    return {"success": True, "subscribed": req.subscribed}

@app.post("/api/auth/trigger-alerts")
def trigger_alerts(req: TriggerAlertsRequest):
    """Helper test endpoint to send email alerts to all subscribed users."""
    if not db.is_connected():
        raise HTTPException(status_code=500, detail="Database not connected")
        
    glacier = db.db["glaciers_processed"].find_one({"glacier_id": req.glacier_id})
    
    glacier_name = req.glacier_id
    region = "Himalayas"
    change_rate = "N/A"
    
    if glacier:
        glacier_name = glacier.get("name", req.glacier_id)
        region = glacier.get("region", "Himalayas")
        change_analysis = glacier.get("change_analysis", {})
        change_rate = change_analysis.get("area_change_rate_pct", "N/A")
        if isinstance(change_rate, (float, int)):
            change_rate = f"{change_rate:.2f}% / year"
    else:
        # Fallback 1: check hazard_predictions in prediction_db
        try:
            pred_db = db.client["prediction_db"]
            pred = pred_db["hazard_predictions"].find_one({"grid_name": req.glacier_id})
            if pred:
                glacier_name = pred.get("grid_name", req.glacier_id)
                region = "Himalayas"
                change_rate = f"Probability: {(pred.get('hazard_probability', 0)*100):.1f}%"
            else:
                # Fallback 2: Check regional mock grids or default construct
                glacier_name = req.glacier_id
                # Deduce region from name
                name_lower = req.glacier_id.lower()
                if "siachen" in name_lower or "baltoro" in name_lower:
                    region = "Karakoram"
                elif "ghasho" in name_lower or "kush" in name_lower:
                    region = "Hindu Kush"
                elif "jakobshavn" in name_lower or "greenland" in name_lower:
                    region = "Arctic"
                else:
                    region = "Monitored Zone"
                change_rate = "Active Telemetry Anomaly Detected"
        except Exception as e:
            print(f"[TRIGGER ALERTS] Fallback lookup failed: {e}")
            change_rate = "Active Telemetry Anomaly Detected"

    subscribers = list(db.db["users"].find({"subscribed": True}))
    if not subscribers:
        return {"success": True, "emails_sent": 0, "message": "No subscribed users found."}
        
    sent_count = 0
    for sub in subscribers:
        email = sub.get("email")
        if email:
            send_alert_email(email, glacier_name, region, req.risk_level, str(change_rate))
            sent_count += 1
            
    return {"success": True, "emails_sent": sent_count}


@app.get("/glaciers")
def get_glaciers(region: Optional[str] = None):
    """Fetch all processed glaciers, optionally filtered by region."""
    if not db.is_connected():
        raise HTTPException(status_code=500, detail="Database not connected")
    
    query = {}
    if region:
        query["region"] = region
        
    glaciers = list(db.db["glaciers_processed"].find(query, {"_id": 0}))
    return {"count": len(glaciers), "data": glaciers}

@app.get("/glaciers/{glacier_id}")
def get_glacier_details(glacier_id: str):
    """Fetch details and history for a specific glacier."""
    if not db.is_connected():
        raise HTTPException(status_code=500, detail="Database not connected")
    
    glacier = db.db["glaciers_processed"].find_one({"glacier_id": glacier_id}, {"_id": 0})
    if not glacier:
        raise HTTPException(status_code=404, detail="Glacier not found")
    
    history = db.get_glacier_history(glacier_id)
    return {"glacier": glacier, "history": history}

@app.get("/files/{filename}")
def get_file(filename: str):
    """Retrieve an image or graph from GridFS."""
    if not db.is_connected():
        raise HTTPException(status_code=500, detail="Database not connected")
    
    file_bytes = db.get_file(filename)
    if not file_bytes:
        raise HTTPException(status_code=404, detail="File not found")
        
    media_type = "image/png" if filename.endswith(".png") else "image/jpeg"
    return Response(content=file_bytes, media_type=media_type)

@app.get("/alerts")
def get_alerts():
    """Fetch glaciers identified as high risk, with fallback to hazard predictions and static events."""
    if not db.is_connected():
        raise HTTPException(status_code=500, detail="Database not connected")
    
    # Primary: high-risk glacier records from processed collection
    query = {"change_analysis.risk_level": {"$in": ["High", "Critical"]}}
    alerts = list(db.db["glaciers_processed"].find(query, {"_id": 0}))

    # Fallback 1: hazard predictions flagged by XGBoost model (MongoDB)
    if len(alerts) == 0:
        try:
            pred_db = db.client["prediction_db"]
            high_risk_preds = list(
                pred_db["hazard_predictions"]
                .find({"hazard_prediction": 1}, {"_id": 0})
                .sort("date", -1)
                .limit(20)
            )
            for p in high_risk_preds:
                alerts.append({
                    "glacier_id": p.get("grid_name", "Unknown Grid"),
                    "name": p.get("grid_name", "Unknown Grid"),
                    "lat": p.get("latitude"),
                    "lon": p.get("longitude"),
                    "status": "High Risk",
                    "risk_level": "High",
                    "hazard_probability": p.get("hazard_probability"),
                    "precipitation_24h_mm": p.get("precipitation_24h_mm"),
                    "ai_summary": p.get("ai_summary", ""),
                    "date": p.get("date"),
                    "source": "hazard_predictions"
                })
        except Exception as pred_err:
            print(f"[ALERTS] Hazard prediction fallback failed: {pred_err}")

    # Fallback 2: load verified historical hazard events from local file
    if len(alerts) == 0:
        try:
            events_path = os.path.join(
                os.path.dirname(__file__), "..", "..",
                "data_prediction", "raw", "weather", "hazard_events.json"
            )
            events_path = os.path.normpath(events_path)
            with open(events_path, "r", encoding="utf-8") as f:
                historical = json.load(f)
            for evt in historical:
                alerts.append({
                    "glacier_id": evt.get("event_id"),
                    "name": evt.get("name"),
                    "lat": evt.get("latitude"),
                    "lon": evt.get("longitude"),
                    "status": evt.get("severity", "High"),
                    "risk_level": evt.get("severity", "High"),
                    "type": evt.get("type"),
                    "date": evt.get("date"),
                    "source": "hazard_events_file"
                })
        except Exception as file_err:
            print(f"[ALERTS] File-based fallback failed: {file_err}")

    return {"count": len(alerts), "alerts": alerts}


@app.post("/api/predict/daily")
def predict_daily(req: DailyPredictionRequest):
    # 1. Fetch Open-Meteo 7-day forecast
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": req.latitude,
        "longitude": req.longitude,
        "daily": "precipitation_sum,temperature_2m_mean",
        "timezone": "GMT"
    }
    
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        daily = resp.json().get("daily", {})
        
        dates = daily.get("time", [])
        precip = [p if p is not None else 0.0 for p in daily.get("precipitation_sum", [])]
        temp = [t if t is not None else 0.0 for t in daily.get("temperature_2m_mean", [])]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch weather forecast: {e}")
        
    if not dates:
        raise HTTPException(status_code=500, detail="Empty weather forecast returned.")
        
    import pandas as pd
    df = pd.DataFrame({
        "precipitation_24h_mm": precip,
        "temp_mean_c": temp
    })
    
    # Calculate rolling 3-day sum
    df["precipitation_72h_mm"] = df["precipitation_24h_mm"].rolling(window=3, min_periods=1).sum()
    # Calculate 5-day temp delta
    df["temp_delta_5d"] = df["temp_mean_c"].diff(periods=5).fillna(0.0)
    df["slope_angle_deg"] = float(req.slope_angle_deg)
    
    # 2. Load trained XGBoost model
    model_path = Path(__file__).parent.parent.parent / "data_prediction" / "models" / "hazard_prediction_model.pkl"
    if not model_path.exists():
        raise HTTPException(status_code=500, detail="Trained model file not found. Please train it first.")
        
    try:
        with open(model_path, "rb") as f:
            model = pickle.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load prediction model: {e}")
        
    feature_cols = [
        "precipitation_24h_mm",
        "temp_mean_c",
        "precipitation_72h_mm",
        "temp_delta_5d",
        "slope_angle_deg"
    ]
    X = df[feature_cols]
    
    # 3. Predict risk levels
    try:
        probs = model.predict_proba(X)[:, 1]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")
        
    predictions = []
    max_risk_level = "Low"
    risk_rank = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}
    
    for idx, date_str in enumerate(dates):
        prob = float(probs[idx])
        if prob < 0.2: risk = "Low"
        elif prob < 0.5: risk = "Medium"
        elif prob < 0.8: risk = "High"
        else: risk = "Critical"
        
        if risk_rank[risk] > risk_rank[max_risk_level]:
            max_risk_level = risk
            
        predictions.append({
            "date": date_str,
            "precipitation_24h_mm": float(precip[idx]),
            "temp_mean_c": float(temp[idx]),
            "hazard_probability": prob,
            "risk_level": risk
        })
        
    # 4. Generate AI Summary using local Ollama model llama3.2:1b
    ollama_url = "http://localhost:11434/api/generate"
    prompt = (
        f"Write a short, professional, 2-sentence summary of the following environmental report: "
        f"Location coordinates: [{req.latitude}, {req.longitude}]. "
        f"Slope angle: {req.slope_angle_deg} degrees. "
        f"Weather: temperatures around {', '.join(f'{t:.1f}C' for t in temp[:3])} and precipitation of {', '.join(f'{p:.1f}mm' for p in precip[:3])}. "
        f"Assessment indicates the overall hazard risk level is currently '{max_risk_level}'. "
        f"Summarize the conditions and state the current risk level clearly."
    )
    
    ai_summary = "AI summary unavailable at this moment."
    try:
        ollama_payload = {
            "model": "llama3.2:1b",
            "prompt": prompt,
            "stream": False
        }
        ollama_resp = requests.post(ollama_url, json=ollama_payload, timeout=120)
        if ollama_resp.status_code == 200:
            ai_summary = ollama_resp.json().get("response", "").strip()
    except Exception as e:
        print(f"Ollama AI description generation failed: {e}")
        
    return {
        "latitude": req.latitude,
        "longitude": req.longitude,
        "slope_angle_deg": req.slope_angle_deg,
        "predictions": predictions,
        "ai_summary": ai_summary
    }

class SpectralPredictionRequest(BaseModel):
    bands: List[float]

@app.post("/api/predict/spectral")
def predict_spectral(req: SpectralPredictionRequest):
    """
    Accepts 218-band hyperspectral pixel values and returns glacier probability
    along with the 8-class terrain type classification.
    """
    if len(req.bands) != 218:
        raise HTTPException(
            status_code=400,
            detail=f"Exactly 218 band values are required. Received {len(req.bands)}."
        )
        
    try:
        from ml_inference import get_ml_engine
        import numpy as np
        
        engine = get_ml_engine()
        bands_arr = np.array(req.bands).reshape(1, -1)
        res = engine.predict(bands_arr)
        
        return {
            "glacier_probability": res["glacier_probability"],
            "is_glacier": res["is_glacier"],
            "terrain_class_id": res["terrain_class_id"],
            "terrain_class_name": res["terrain_class_name"],
            "model_used": "Gradient Boosting / Logistic Regression"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Spectral inference execution failed: {e}"
        )

from typing import Any

@app.post("/api/ingest/raw")
def ingest_raw_data(payload: Any = Body(...), source: str = "Curated_Inventory"):
    """
    Accepts raw glacier records from official APIs (GLIMS, WGMS, RGI, Curated)
    and processes them into enriched, map-ready JSON.
    """
    intermediate_records = []

    try:
        if source == "GLIMS":
            # Extract features from GLIMS payload
            features = []
            if isinstance(payload, dict):
                features = payload.get("features", []) or [payload]
            elif isinstance(payload, list):
                features = payload
                
            for feature in features:
                props = feature.get("properties", feature) if isinstance(feature, dict) else {}
                lat = props.get("cenlat") or props.get("lat")
                lon = props.get("cenlon") or props.get("lon")
                
                # Default ID generation helper
                glac_id = props.get("glac_id")
                if not glac_id and lat and lon:
                    glac_id = f"{abs(lat):.3f}_{abs(lon):.3f}"
                    
                intermediate_records.append({
                    "glacier_id": f"GLIMS_{glac_id}",
                    "name": props.get("glac_name") or props.get("name") or "Unnamed",
                    "lat": lat,
                    "lon": lon,
                    "area_km2": props.get("area") or props.get("area_km2") or 0.0,
                    "survey_date": props.get("src_date") or props.get("survey_date"),
                    "country": props.get("country", "India"),
                    "source": "GLIMS"
                })

        elif source == "WGMS":
            items = payload if isinstance(payload, list) else [payload]
            for item in items:
                if not isinstance(item, dict):
                    continue
                lat = item.get("latitude") or item.get("lat")
                lon = item.get("longitude") or item.get("lon")
                
                wgms_id = item.get("wgms_id")
                if not wgms_id and lat and lon:
                    wgms_id = f"{abs(lat):.3f}_{abs(lon):.3f}"
                    
                intermediate_records.append({
                    "glacier_id": f"WGMS_{wgms_id}",
                    "name": item.get("name") or item.get("glacier_name") or "Unknown",
                    "lat": lat,
                    "lon": lon,
                    "area_km2": item.get("area") or item.get("area_km2") or 0.0,
                    "elevation_m": item.get("elevation") or item.get("elevation_m"),
                    "source": "WGMS"
                })

        elif source == "RGI":
            features = []
            if isinstance(payload, dict):
                features = payload.get("features", []) or [payload]
            elif isinstance(payload, list):
                features = payload
                
            for feature in features:
                props = feature.get("properties", feature) if isinstance(feature, dict) else {}
                lat = props.get("cenlat") or props.get("lat")
                lon = props.get("cenlon") or props.get("lon")
                
                rgi_id = props.get("rgi_id")
                if not rgi_id and lat and lon:
                    rgi_id = f"{abs(lat):.3f}_{abs(lon):.3f}"
                    
                intermediate_records.append({
                    "glacier_id": f"RGI_{rgi_id}",
                    "name": props.get("name") or "RGI Glacier",
                    "lat": lat,
                    "lon": lon,
                    "area_km2": props.get("area") or props.get("area_km2") or 0.0,
                    "source": "RGI"
                })

        elif source == "Curated_Inventory":
            items = payload if isinstance(payload, list) else [payload]
            for item in items:
                if not isinstance(item, dict):
                    continue
                intermediate_records.append({
                    "glacier_id": item.get("glacier_id") or f"Curated_{random.randint(1000, 9999)}",
                    "name": item.get("name") or "Unnamed Curated",
                    "lat": item.get("lat") or item.get("latitude"),
                    "lon": item.get("lon") or item.get("longitude"),
                    "area_km2": item.get("area_km2") or item.get("area") or 0.0,
                    "length_km": item.get("length_km"),
                    "elevation_m": item.get("elevation_m") or item.get("elevation"),
                    "region": item.get("region"),
                    "state": item.get("state"),
                    "type": item.get("type"),
                    "status": item.get("status") or "Monitoring",
                    "note": item.get("note"),
                    "country": item.get("country", "India"),
                    "source": "Curated_Inventory"
                })
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown source format: {source}. Supported: GLIMS, WGMS, RGI, Curated_Inventory"
            )

        if not intermediate_records:
            return []

        # Coordinate Filtering & State Bounding Checks
        valid = processor_engine._validate_and_filter(intermediate_records)
        
        # Region Matching & Styling
        enriched = [processor_engine._enrich(r) for r in valid]
        
        # Apply AI Classifier Confidence and Terrain Cover percentages
        for r in enriched:
            processor_engine._classify_imagery(r)

        return enriched

    except HTTPException:
        raise   # re-raise 4xx errors as-is (e.g. 400 for unknown source)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Raw ingestion processing failed: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

