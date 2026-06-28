import os
import sys
import pickle
import logging
import pandas as pd
import numpy as np
from datetime import datetime
from pymongo import MongoClient
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score, precision_score, recall_score
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("ModelTrainer")

# Configuration
DATASET_PATH = "data_prediction/processed/tabular/dataset.csv"
MODEL_OUTPUT_DIR = "data_prediction/models"
MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "prediction_db"
MODEL_METRICS_COL = "model_checkpoints"

FEATURE_COLS = [
    "precipitation_24h_mm",
    "temp_mean_c",
    "precipitation_72h_mm",
    "temp_delta_5d",
    "slope_angle_deg"
]
TARGET_COL = "hazard_label"

def main():
    logger.info("Step 1: Loading preprocessed training dataset...")
    if not os.path.exists(DATASET_PATH):
        logger.error(f"Dataset not found at {DATASET_PATH}. Please run the preprocessor first.")
        sys.exit(1)
        
    df = pd.read_csv(DATASET_PATH)
    
    # Separate features and target
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]
    
    logger.info(f"Feature matrix shape: {X.shape}, Target distribution: {y.value_counts().to_dict()}")
    
    # Split into train and test sets (stratified split to maintain class ratio)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )
    
    # Calculate class weight ratio for imbalance handling
    neg_count = (y_train == 0).sum()
    pos_count = (y_train == 1).sum()
    # Avoid division by zero
    pos_count = max(pos_count, 1)
    scale_pos_weight = neg_count / pos_count
    
    logger.info(f"Class imbalance ratio (neg/pos): {scale_pos_weight:.2f}")
    
    # Initialize algorithms to compare
    models = {
        "LogisticRegression": LogisticRegression(
            class_weight="balanced", 
            random_state=42, 
            max_iter=1000
        ),
        "RandomForest": RandomForestClassifier(
            class_weight="balanced", 
            n_estimators=100, 
            random_state=42
        ),
        "XGBoost": XGBClassifier(
            scale_pos_weight=scale_pos_weight, 
            n_estimators=100, 
            random_state=42,
            eval_metric="logloss"
        )
    }
    
    results = {}
    best_model_name = None
    best_f1 = -1.0
    best_model_obj = None
    
    logger.info("Step 2: Training and evaluating multiple models...")
    for name, clf in models.items():
        logger.info(f"=== Training {name} ===")
        clf.fit(X_train, y_train)
        
        # Predict on test set
        y_pred = clf.predict(X_test)
        
        # Calculate evaluation metrics
        f1 = f1_score(y_test, y_pred, zero_division=0)
        precision = precision_score(y_test, y_pred, zero_division=0)
        recall = recall_score(y_test, y_pred, zero_division=0)
        
        logger.info(f"\n{classification_report(y_test, y_pred, zero_division=0)}")
        
        results[name] = {
            "f1_score": float(f1),
            "precision": float(precision),
            "recall": float(recall)
        }
        
        # Track the best model based on F1 Score
        if f1 >= best_f1:
            best_f1 = f1
            best_model_name = name
            best_model_obj = clf

    logger.info(f"Step 3: Best performing algorithm: {best_model_name} (F1 Score: {best_f1:.2f})")
    
    # Step 4: Save the best model locally as a pickle file
    os.makedirs(MODEL_OUTPUT_DIR, exist_ok=True)
    model_file_path = os.path.join(MODEL_OUTPUT_DIR, "hazard_prediction_model.pkl")
    logger.info(f"Saving best model checkpoint to {model_file_path}...")
    with open(model_file_path, "wb") as f:
        pickle.dump(best_model_obj, f)
    logger.info("Best model saved successfully.")
    
    # Step 5: Save training run metadata and performance metrics to MongoDB
    logger.info(f"Step 6: Storing training results in MongoDB collection '{DB_NAME}.{MODEL_METRICS_COL}'...")
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        col = db[MODEL_METRICS_COL]
        
        checkpoint_record = {
            "model_name": best_model_name,
            "trained_at": datetime.utcnow().isoformat(),
            "features_used": FEATURE_COLS,
            "target": TARGET_COL,
            "training_samples": len(X_train),
            "testing_samples": len(X_test),
            "algorithm_comparisons": results,
            "best_model_performance": results[best_model_name]
        }
        
        col.insert_one(checkpoint_record)
        logger.info("Successfully registered trained model metrics in database.")
        client.close()
    except Exception as e:
        logger.error(f"Failed to record model metadata in MongoDB: {e}")
        
    logger.info("Model training pipeline completed successfully.")

if __name__ == "__main__":
    main()
