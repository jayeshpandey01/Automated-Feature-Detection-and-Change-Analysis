import os
import sys
import shutil
from pathlib import Path
from datetime import datetime

# Adjust sys.path to ensure modules can be imported if run from project root
sys.path.append(str(Path(__file__).parent.parent))

from src.image_data_download.data_download import run_pipeline as download_pipeline

def main():
    days_back = 30
    
    print(f"[*] Starting E2E run for data since {days_back} days back.")
    
    # 2. Run the downloader pipeline
    # The data_download.py pipeline automatically triggers the ML processing (automated_pipeline.py)
    # as Stage 9 if downloads occurred. So this orchestrates the full end-to-end flow.
    print("[*] Launching data download and automated processing pipeline...")
    result = download_pipeline(
        region_key="all",
        days_back=days_back,
        download_images=True,
        max_downloads=5,            # Cap to avoid filling disk completely
        download_source="copernicus",
        satellites="s2",            # S2 corresponds to Sentinel-2 which has the bands we need
        sentinel_only=True
    )
    
    print("\n[*] Pipeline execution finished.")
    
    download_summary = result.get('download_summary', {})
    print(f"[*] Download Summary: {download_summary}")
    print(f"[*] JSON metadata path: {result.get('json_path')}")
    
    # 3. Clean up raw downloaded ZIPs and extracted files to conserve disk space
    # The pipeline uses relative paths from the current working directory.
    project_root = Path(__file__).parent.parent
    raw_dir = project_root / "raw_data"
    extracted_dir = project_root / "processed_data" / "extracted"
    
    print("\n[*] Performing disk cleanup...")
    
    if raw_dir.exists():
        for zip_file in raw_dir.rglob("*.zip"):
            try:
                zip_file.unlink()
                print(f"  - [DELETED] {zip_file.name}")
            except Exception as e:
                print(f"  - [ERROR] Failed to delete {zip_file.name}: {e}")
    else:
        print(f"  - Directory {raw_dir} not found. Skipping raw zip cleanup.")
                
    if extracted_dir.exists():
        try:
            shutil.rmtree(extracted_dir)
            print(f"  - [DELETED] Extracted directory {extracted_dir}")
        except Exception as e:
            print(f"  - [ERROR] Failed to remove {extracted_dir}: {e}")
    else:
        print(f"  - Directory {extracted_dir} not found. Skipping extraction cleanup.")
            
    print("[*] Clean-up complete. The E2E run is fully successful.")

if __name__ == "__main__":
    main()
