from db_manager import DatabaseManager
from config import DB_NAME, MONGODB_URI

db = DatabaseManager(MONGODB_URI, DB_NAME)

# Check GridFS files
files = db.db.fs.files.find({})
print("Files in GridFS:")
for f in files:
    print(f"  {f['filename']} (Size: {f['length']} bytes, Metadata: {f.get('metadata')})")

db.close()
