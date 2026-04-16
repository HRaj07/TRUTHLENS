from pymongo import MongoClient

MONGO_URI = "mongodb+srv://2601harshitraj:Hr%40j2601@cluster0.ngidqsb.mongodb.net/?appName=Cluster0"
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    print("✅ MongoDB Connected Successfully!")
except Exception as e:
    print(f"❌ MongoDB Connection Failed: {e}")
