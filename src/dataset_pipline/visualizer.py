import matplotlib.pyplot as plt
import io
import logging
from typing import List, Dict
from datetime import datetime

logger = logging.getLogger("GlacierPipeline.Visualizer")

class GlacierVisualizer:
    """Generates charts and visualizations for glacier trends."""

    def generate_history_graph(self, name: str, history: List[Dict]) -> bytes:
        """
        Generates a PNG graph of area over time for a glacier.
        Returns the image as bytes.
        """
        if not history:
            return b""

        # Sort history by date
        sorted_history = sorted(history, key=lambda x: x["timestamp"])
        
        dates = []
        areas = []
        for h in sorted_history:
            ts = h["timestamp"]
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            dates.append(ts)
            areas.append(h["area_km2"])

        plt.figure(figsize=(10, 6))
        plt.style.use('dark_background')
        
        plt.plot(dates, areas, marker='o', linestyle='-', color='#00E5FF', linewidth=2, markersize=8)
        plt.fill_between(dates, areas, color='#00E5FF', alpha=0.1)
        
        plt.title(f"Glacier Area Trend: {name}", fontsize=16, color='#FFFFFF', pad=20)
        plt.xlabel("Date", fontsize=12, color='#9CA3AF')
        plt.ylabel("Area (km²)", fontsize=12, color='#9CA3AF')
        
        plt.grid(True, linestyle='--', alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()

        # Save to buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100)
        plt.close()
        
        return buf.getvalue()
