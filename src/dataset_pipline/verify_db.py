from db_manager import DatabaseManager
from config import DB_NAME, MONGODB_URI

db = DatabaseManager(MONGODB_URI, DB_NAME)

if not db.is_connected():
    print("MongoDB not connected")
    exit(1)

# Check history entries
history_count = db.db["glacier_history"].count_documents({})
processed_count = db.db["glaciers_processed"].count_documents({})
print(f"glacier_history entries : {history_count}")
print(f"glaciers_processed docs : {processed_count}")
print()

# Get history for one glacier
sample = db.db["glacier_history"].find_one({}, {"_id": 0})
if sample:
    gid = sample["glacier_id"]
    entries = db.get_glacier_history(gid)
    print(f"History for glacier_id: {gid}")
    for e in entries:
        print(f"  timestamp: {e['timestamp']}  area: {e.get('area_km2')} km2")

db.close()
