"""
===========================================================
  GlacioWatch: Harvester and Real-Time ML Inference Engine
===========================================================

Exposes the pre-trained ML models from output/model/ to:
  1. Scale input spectral features (218 dimensions)
  2. Perform PCA dimensionality reduction (10 components)
  3. Run binary glacier prediction (GradientBoosting)
  4. Run multiclass terrain classification (LogisticRegression)
"""

import os
import sys
import joblib
import numpy as np

# Suppress oneDNN warning on CPU
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

MODEL_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "output", "model")
)

# Class Map for Multiclass Terrain Model
TERRAIN_CLASSES = {
    0: "alpine meadow",
    1: "alpine tundra",
    2: "bare rock",
    3: "dark rock",
    4: "snow / ice",
    5: "scree / sunlit rock",
    6: "valley floor / meadow",
    7: "veg-scree mix"
}

class GlacierMLEngine:
    def __init__(self):
        self.scaler = joblib.load(os.path.join(MODEL_DIR, "standard_scaler.pkl"))
        self.pca = joblib.load(os.path.join(MODEL_DIR, "pca_10components.pkl"))
        self.binary_model = joblib.load(os.path.join(MODEL_DIR, "best_binary_glacier.pkl"))
        self.multiclass_model = joblib.load(os.path.join(MODEL_DIR, "best_multiclass_model.pkl"))
        
    def predict(self, raw_bands_218):
        """
        Runs the full inference pipeline on raw_bands_218 (numpy array).
        Expects shape (n_samples, 218)
        """
        X = np.atleast_2d(raw_bands_218)
        X_scaled = self.scaler.transform(X)
        X_pca = self.pca.transform(X_scaled)
        
        # Binary prediction (probability of glacier)
        glacier_probs = self.binary_model.predict_proba(X_pca)[:, 1]
        
        # Multiclass prediction (class labels 0-7)
        terrain_labels = self.multiclass_model.predict(X_scaled)
        
        results = []
        for i in range(len(X)):
            prob = float(glacier_probs[i])
            label_id = int(terrain_labels[i])
            results.append({
                "glacier_probability": prob,
                "is_glacier": bool(prob >= 0.5),
                "terrain_class_id": label_id,
                "terrain_class_name": TERRAIN_CLASSES.get(label_id, "unknown")
            })
        return results if len(results) > 1 else results[0]

# Global instance for shared imports
_engine = None

def get_ml_engine():
    global _engine
    if _engine is None:
        _engine = GlacierMLEngine()
    return _engine
