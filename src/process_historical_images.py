import os
import sys
import logging
from pathlib import Path

# Add src to python path to import GlacierPipeline
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from src.automated_pipeline import GlacierPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ProcessHistoricalImages")

def main():
    pipeline = GlacierPipeline()
    pipeline.load_models()
    
    # Locate all glacier_stats_*.json files
    dir1 = Path("src/dataset_pipline/output")
    dir2 = Path("output")
    
    stats_files = []
    if dir1.exists():
        stats_files.extend(list(dir1.glob("glacier_stats_*.json")))
    if dir2.exists():
        stats_files.extend(list(dir2.glob("glacier_stats_*.json")))
        
    unique_timestamps = set()
    for f in stats_files:
        # Format: glacier_stats_YYYYMMDD_HHMMSS.json
        parts = f.stem.replace("glacier_stats_", "").split("_")
        if len(parts) >= 2:
            unique_timestamps.add(f"{parts[0]}_{parts[1]}")
            
    logger.info(f"Found {len(unique_timestamps)} unique historical execution runs to process: {unique_timestamps}")
    
    # Locate the valid extracted Sentinel-2 granule directory
    extracted_root = Path("processed_data/extracted")
    granule_dirs = list(extracted_root.glob("*.SAFE"))
    if not granule_dirs:
        logger.error("No valid extracted SAFE granules found in processed_data/extracted!")
        sys.exit(1)
        
    ref_granule = granule_dirs[0]
    logger.info(f"Using reference granule for processing: {ref_granule.name}")
    
    
    # Run prediction and save timestamped map for each execution
    for ts in unique_timestamps:
        output_file = Path("website/public/images/output") / f"prediction_{ts}.png"
        if output_file.exists():
            logger.info(f"Processed image for run {ts} already exists. Skipping.")
            continue
            
        logger.info(f"Generating processed image output for execution {ts}...")
        pred_img, meta = pipeline.process_sentinel_granule(ref_granule)
        if pred_img is not None and meta is not None:
            pipeline.save_prediction_results(pred_img, meta, ref_granule.name, timestamp_str=ts)
            logger.info(f"✅ Generated processed image for {ts}: {output_file.name}")
        else:
            logger.error(f"❌ Failed to generate processed image for {ts}")

    logger.info("Historical processing completed successfully.")

if __name__ == "__main__":
    main()
