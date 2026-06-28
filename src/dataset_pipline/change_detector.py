"""
Change Detector for Glacier Monitoring
Calculates area changes, retreat rates, and flags high-risk glaciers.
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional

logger = logging.getLogger("GlacierPipeline.ChangeDetector")

class ChangeDetector:
    """Analyzes historical glacier data to identify trends and risks."""

    # Thresholds for risk levels
    RISK_THRESHOLDS = {
        "stable": 0.5,      # % change per year
        "retreat": 2.0,     # % change per year
        "rapid": 5.0        # % change per year
    }

    def detect_changes(self, current_record: Dict, history: List[Dict]) -> Dict:
        """
        Compares current record with previous snapshots.
        'history' is expected to be sorted by timestamp descending.
        """
        if not history or len(history) < 1:
            return {
                "change_status": "Insufficient Data",
                "area_delta_km2": 0,
                "percent_change": 0,
                "annual_rate": 0,
                "risk_level": "Low"
            }

        # Current is current_record, Previous is history[0]
        latest = current_record
        previous = history[0]

        area_latest = latest.get("area_km2") or 0
        area_prev = previous.get("area_km2") or 0
        
        if area_prev == 0:
            return {"change_status": "Baseline Established"}

        # Calculate Delta
        delta_area = area_latest - area_prev
        percent_change = (delta_area / area_prev) * 100
        
        # Calculate Time Delta (Years)
        t_latest = latest.get("processed_at") or latest.get("timestamp") or datetime.now(timezone.utc)
        t_prev = previous.get("timestamp") or previous.get("processed_at") or datetime.now(timezone.utc)
        
        # Ensure they are datetime objects and timezone-aware
        if isinstance(t_latest, str):
            t_latest = datetime.fromisoformat(t_latest.replace("Z", "+00:00"))
        if isinstance(t_prev, str):
            t_prev = datetime.fromisoformat(t_prev.replace("Z", "+00:00"))
        
        # Make timezone-aware if naive (MongoDB sometimes returns naive datetimes)
        if t_latest.tzinfo is None:
            t_latest = t_latest.replace(tzinfo=timezone.utc)
        if t_prev.tzinfo is None:
            t_prev = t_prev.replace(tzinfo=timezone.utc)
            
        time_delta_years = (t_latest - t_prev).total_seconds() / (365.25 * 24 * 3600)
        
        if time_delta_years < 0.01: # Avoid division by zero
            annual_rate = 0
        else:
            annual_rate = percent_change / time_delta_years

        # Determine Risk Level
        abs_rate = abs(annual_rate)
        if abs_rate < self.RISK_THRESHOLDS["stable"]:
            risk = "Low"
            status = "Stable"
        elif abs_rate < self.RISK_THRESHOLDS["retreat"]:
            risk = "Medium"
            status = "Retreating"
        elif abs_rate < self.RISK_THRESHOLDS["rapid"]:
            risk = "High"
            status = "Rapid Retreat"
        else:
            risk = "Critical"
            status = "Extreme Melting"

        return {
            "change_status": status,
            "area_delta_km2": round(delta_area, 3),
            "percent_change": round(percent_change, 2),
            "annual_rate": round(annual_rate, 2),
            "risk_level": risk,
            "years_between": round(time_delta_years, 2)
        }
