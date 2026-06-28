import os
import zipfile
import rasterio
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from datetime import datetime, timezone
import logging
import sys

# Add project root to sys.path
sys.path.append(str(Path(__file__).parent.parent))

from src.dataset_pipline.db_manager import DatabaseManager
from src.dataset_pipline.config import MONGODB_URI, DB_NAME

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("GlacierAutomation")

class GlacierPipeline:
    def __init__(self):
        self.raw_dir = Path("raw_data")
        self.extracted_dir = Path("processed_data/extracted")
        self.output_dir = Path("output/results")
        self.model_path = Path("output/model/best_glacier_detection_model.pkl")
        self.scaler_path = Path("output/model/standard_scaler.pkl")
        self.pca_path = Path("output/model/pca_10components.pkl")
        
        self.extracted_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.db = DatabaseManager(MONGODB_URI, DB_NAME)
        self.model = None
        self.scaler = None
        self.pca = None

    def load_models(self):
        """Load the trained model and preprocessing objects."""
        if self.model_path.exists():
            self.model = joblib.load(self.model_path)
            logger.info(f"Loaded model from {self.model_path}")
        if self.scaler_path.exists():
            self.scaler = joblib.load(self.scaler_path)
            logger.info(f"Loaded scaler from {self.scaler_path}")
        if self.pca_path.exists():
            self.pca = joblib.load(self.pca_path)
            logger.info(f"Loaded PCA from {self.pca_path}")

    def extract_zip(self, zip_path):
        """Extract the downloaded imagery."""
        logger.info(f"Extracting {zip_path}...")
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # Extract directly into extracted_dir to avoid path too long errors on Windows
                target = self.extracted_dir
                # Find what the top level folder is inside the zip
                top_level = zip_ref.namelist()[0].split('/')[0]
                zip_ref.extractall(target)
                return target / top_level
        except zipfile.BadZipFile:
            logger.warning(f"Failed to extract {zip_path}: Not a valid zip file. Skipping.")
            return None

    def calculate_indices(self, df, total_bands):
        """Calculate spectral indices as defined in the user's algorithm."""
        def norm(s):
            mn, mx = s.min(), s.max()
            return (s - mn) / (mx - mn + 1e-10)

        def get_band(idx):
            idx = max(1, min(int(idx), total_bands))
            return norm(df[f"Band_{idx}"])

        # Core visible bands
        b1n = get_band(1)   # Blue
        b2n = get_band(2)   # Green
        b3n = get_band(3)   # Red

        # Dynamically pick NIR & SWIR (Sentinel-2 logic)
        if total_bands >= 8:
            nir  = get_band(8)
            swir = get_band(min(11, total_bands))
        else:
            nir = b3n # Fallback
            swir = b3n

        # Spectral indices
        df['ndvi'] = (nir - b3n) / (nir + b3n + 1e-10)
        df['ndwi'] = (b2n - nir) / (b2n + nir + 1e-10)
        df['ndti'] = (swir - nir) / (swir + nir + 1e-10) # Using NDBI/NDTI logic
        
        return df

    def process_tif(self, tif_path):
        """Process a single TIF file: feature extraction + prediction."""
        logger.info(f"Processing {tif_path}...")
        with rasterio.open(tif_path) as src:
            total_bands = src.count
            
            # Downsample to 5% to prevent MemoryError on huge Sentinel-2 images
            scale = 0.05
            height = int(src.height * scale)
            width = int(src.width * scale)
            
            meta = src.meta.copy()
            meta.update({
                "height": height, 
                "width": width,
                "transform": src.transform * src.transform.scale(1/scale, 1/scale)
            })
            
            bands = {}
            for i in range(1, total_bands + 1):
                data = src.read(
                    i, 
                    out_shape=(height, width), 
                    resampling=rasterio.enums.Resampling.bilinear
                )
                bands[f"Band_{i}"] = data.astype(np.float32).ravel()
            
            df = pd.DataFrame(bands)
            
        # Calculate indices
        df = self.calculate_indices(df, total_bands)
        
        # Prepare for prediction
        # The model likely expects [Band_1...N, ndvi, ndwi, ndti]
        # We need to match the feature list used during training.
        # Based on the notebook, it uses all bands + indices.
        
        # Pad with zeros to match 218 features expected by PCA/Scaler
        X = df.values.astype(np.float32)
        if X.shape[1] < 218:
            padding = np.zeros((X.shape[0], 218 - X.shape[1]), dtype=np.float32)
            X = np.hstack([X, padding])
        elif X.shape[1] > 218:
            X = X[:, :218]
            
        if self.scaler:
            X = self.scaler.transform(X)
        if self.pca:
            X = self.pca.transform(X)
            
        # Predict
        if self.model:
            preds = self.model.predict(X)
            pred_img = preds.reshape((height, width))
            
            # Simple threshold check if bands are available
            if "Band_2" in df and "Band_5" in df:
                green = df["Band_2"].values.reshape((height, width))
                swir = df["Band_5"].values.reshape((height, width))
                ndsi = (green - swir) / (green + swir + 1e-10)
                pred_img = (pred_img == 1) & (ndsi > 0.12)
                pred_img = pred_img.astype(np.uint8)
                
            return pred_img, meta
        return None, None

    def process_sentinel_granule(self, granule_dir):
        """Process a Sentinel-2 granule directory by stacking bands and predicting."""
        logger.info(f"Processing Sentinel-2 granule {granule_dir.name}...")
        
        # Find the bands inside granule_dir
        bands_paths = {}
        for band in ["B02", "B03", "B04", "B08", "B11"]:
            files = list(granule_dir.rglob(f"*_{band}_*.jp2"))
            if files:
                # Prefer 10m for visible/NIR bands if available, otherwise pick the first
                files_sorted = sorted(files, key=lambda f: "10m" in f.name, reverse=True)
                bands_paths[band] = files_sorted[0]
                
        required_bands = ["B02", "B03", "B04", "B08", "B11"]
        missing = [b for b in required_bands if b not in bands_paths]
        if missing:
            logger.warning(f"Granule {granule_dir.name} is missing bands: {missing}. Skipping.")
            return None, None
            
        # Read and downsample bands
        # Use B02 as reference for shape and transform
        ref_path = bands_paths["B02"]
        with rasterio.open(ref_path) as ref_src:
            scale = 0.05
            height = int(ref_src.height * scale)
            width = int(ref_src.width * scale)
            meta = ref_src.meta.copy()
            meta.update({
                "height": height, 
                "width": width,
                "count": 5,
                "transform": ref_src.transform * ref_src.transform.scale(1/scale, 1/scale)
            })
            
        bands_data = {}
        for idx, band in enumerate(required_bands):
            band_path = bands_paths[band]
            with rasterio.open(band_path) as src:
                data = src.read(
                    1, 
                    out_shape=(height, width), 
                    resampling=rasterio.enums.Resampling.bilinear
                )
                bands_data[f"Band_{idx+1}"] = data.astype(np.float32).ravel()
                
        df = pd.DataFrame(bands_data)
        
        # Calculate indices (stacked bands count = 5)
        df = self.calculate_indices(df, 5)
        
        # Prepare for prediction (pad to 218 features)
        X = df.values.astype(np.float32)
        if X.shape[1] < 218:
            padding = np.zeros((X.shape[0], 218 - X.shape[1]), dtype=np.float32)
            X = np.hstack([X, padding])
        elif X.shape[1] > 218:
            X = X[:, :218]
            
        if self.scaler:
            X = self.scaler.transform(X)
        if self.pca:
            X = self.pca.transform(X)
            
        # Predict using binary model
        if self.model:
            preds = self.model.predict(X)
            pred_img = preds.reshape((height, width))
            
            # Apply NDSI filter to remove false positives in non-snow regions
            green = df["Band_2"].values.reshape((height, width))
            swir = df["Band_5"].values.reshape((height, width))
            ndsi = (green - swir) / (green + swir + 1e-10)
            
            # Threshold: snow/ice has high NDSI
            pred_img = (pred_img == 1) & (ndsi > 0.12)
            pred_img = pred_img.astype(np.uint8)
            
            return pred_img, meta
            
        return None, None

    def save_prediction_results(self, pred_img, meta, name_identifier, timestamp_str=None):
        """Save prediction results (map image, database record, etc.)."""
        # Calculate Glacier Area (using binary classifier, 1 is glacier)
        glacier_pixels = np.sum(pred_img == 1)
        pixel_area = meta['transform'][0] * abs(meta['transform'][4]) # Usually 10x10=100 for S2
        area_km2 = (glacier_pixels * pixel_area) / 1e6
        
        # Determine Risk
        risk = "Low"
        if area_km2 > 5: risk = "Medium"
        if area_km2 > 10: risk = "High"
        
        # Create Record
        glacier_id = name_identifier[:16]
        record = {
            "glacier_id": glacier_id,
            "name": name_identifier,
            "area_km2": area_km2,
            "status": "Active" if area_km2 > 0 else "Extinct",
            "risk_level": risk,
            "source": "Sentinel-2" if "L2A" in name_identifier else "EnMAP",
            "region": "Himalaya", # Default for now
            "location": {
                "type": "Point",
                "coordinates": [77.0, 32.0] # Fallback coordinates
            },
            "last_updated": datetime.now(timezone.utc)
        }
        
        # Dynamically extract location center coordinates
        if meta and 'transform' in meta and 'crs' in meta:
            try:
                import pyproj
                center_x = meta['transform'][2] + (meta['width'] / 2) * meta['transform'][0]
                center_y = meta['transform'][5] + (meta['height'] / 2) * meta['transform'][4]
                
                src_crs = pyproj.CRS(meta['crs'])
                dst_crs = pyproj.CRS.from_epsg(4326)
                transformer = pyproj.Transformer.from_crs(src_crs, dst_crs, always_xy=True)
                lon, lat = transformer.transform(center_x, center_y)
                if -180 <= lon <= 180 and -90 <= lat <= 90:
                    record["location"]["coordinates"] = [round(lon, 4), round(lat, 4)]
            except Exception as e:
                logger.warning(f"Could not extract coordinates from metadata: {e}")
                
        # Save to DB
        if self.db.is_connected():
            self.db.upsert_processed_glaciers([record])
            
        # Always save prediction map as image for the frontend
        import matplotlib.pyplot as plt
        from matplotlib.patches import Patch
        from io import BytesIO
        
        h, w = pred_img.shape
        rgb = np.zeros((h, w, 3), dtype=np.float32)
        
        # Deep space dark background: #0b0f19 (RGB: 11, 15, 25)
        rgb[:, :] = [11/255, 15/255, 25/255]
        
        # Glacier pixels: glowing neon cyan: #00f3ff (RGB: 0, 243, 255)
        rgb[pred_img == 1] = [0/255, 243/255, 255/255]
        
        fig, ax = plt.subplots(figsize=(10, 10), facecolor='#0b0f19')
        ax.imshow(rgb)
        ax.axis('off')
        
        # Add title
        ax.set_title(f"Glacier Classification Map - {name_identifier}", color='#00f3ff', fontsize=14, pad=15, fontweight='bold')
        
        # Add legend
        legend_elements = [
            Patch(facecolor='#00f3ff', label='Detected Glacier / Ice Cover'),
            Patch(facecolor='#0b0f19', edgecolor='#1e293b', label='Background Terrain')
        ]
        ax.legend(handles=legend_elements, loc='lower right', facecolor='#111625', edgecolor='#1e293b', labelcolor='white', fontsize=10)
        
        buf = BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.2, facecolor='#0b0f19')
        buf.seek(0)
        plt.close(fig)
        
        if self.db.is_connected():
            filename = f"map_{glacier_id}.png"
            self.db.save_file(filename, buf.getvalue(), metadata={"glacier_id": glacier_id})
        
        # Also save directly to frontend public directory
        frontend_dir = Path("website/public/images/output")
        frontend_dir.mkdir(parents=True, exist_ok=True)
        with open(frontend_dir / "latest_prediction.png", "wb") as f:
            f.write(buf.getvalue())
            
        if timestamp_str:
            with open(frontend_dir / f"prediction_{timestamp_str}.png", "wb") as f:
                f.write(buf.getvalue())
        
        logger.info(f"Ingested glacier {glacier_id} with area {area_km2:.2f} km2")

    def run(self):
        """Orchestrate the entire pipeline."""
        self.load_models()
        
        zips = list(self.raw_dir.glob("**/*.zip"))
        if not zips:
            logger.info("No new ZIP files found in raw_data/")
            return

        for zip_path in zips:
            extracted_path = self.extract_zip(zip_path)
            if extracted_path is None:
                continue
                
            # Find image files
            img_files = list(extracted_path.rglob("*.jp2")) + list(extracted_path.rglob("*.tif*"))
            
            jp2_files = [f for f in img_files if f.suffix.lower() == ".jp2"]
            tif_files = [f for f in img_files if f.suffix.lower() in [".tif", ".tiff"]]
            
            # Process Sentinel-2 granules
            processed_granules = set()
            for img_file in jp2_files:
                if "IMG_DATA" in img_file.parts:
                    granule_dir = img_file.parent.parent.parent
                    if granule_dir in processed_granules:
                        continue
                    processed_granules.add(granule_dir)
                    
                    pred_img, meta = self.process_sentinel_granule(granule_dir)
                    if pred_img is not None:
                        self.save_prediction_results(pred_img, meta, granule_dir.name)
                        
            # Process standalone TIF files
            for img_file in tif_files:
                pred_img, meta = self.process_tif(img_file)
                if pred_img is not None:
                    self.save_prediction_results(pred_img, meta, img_file.stem)

if __name__ == "__main__":
    pipeline = GlacierPipeline()
    pipeline.run()
