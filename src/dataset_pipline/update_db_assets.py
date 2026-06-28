import os
import sys
import logging
from db_manager import DatabaseManager
from config import MONGODB_URI, DB_NAME

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("UpdateDBAssets")

def main():
    db = DatabaseManager(MONGODB_URI, DB_NAME)
    if not db.is_connected():
        logger.error("Failed to connect to MongoDB")
        sys.exit(1)

    assets_dir = os.path.join(os.path.dirname(__file__), "..", "..", "website", "public", "images", "output")
    assets_dir = os.path.abspath(assets_dir)

    if not os.path.exists(assets_dir):
        logger.error(f"Assets directory not found: {assets_dir}")
        sys.exit(1)

    count = 0
    for root, _, files in os.walk(assets_dir):
        for file in files:
            filepath = os.path.join(root, file)
            with open(filepath, "rb") as f:
                content = f.read()
            
            metadata = {
                "source": "model_output",
                "type": "image/jpeg" if file.endswith(".jpg") else "image/png"
            }
            
            # Using the filename relative to the output directory as the GridFS filename
            gridfs_filename = file
            file_id = db.save_file(gridfs_filename, content, metadata)
            if file_id:
                logger.info(f"✅ Saved {file} to GridFS with ID: {file_id}")
                count += 1
            else:
                logger.error(f"❌ Failed to save {file}")

    logger.info(f"Finished uploading {count} assets to MongoDB GridFS.")

if __name__ == "__main__":
    main()
