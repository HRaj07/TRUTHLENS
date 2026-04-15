import os
import json
import hashlib
import secrets
from datetime import datetime
from pymongo import MongoClient
import urllib.parse

# MongoDB Connection
# The password "Hr@j2601" needs to be URL encoded if it contains special characters like @
# Hr@j2601 -> Hr%40j2601
# But the user provided Hr@j2601 in the format mongodb+srv://2601harshitraj:Hr@j2601@cluster0...
# Let's handle it robustly.

MONGO_URI = "mongodb+srv://2601harshitraj:Hr%40j2601@cluster0.ngidqsb.mongodb.net/?appName=Cluster0"
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # The ismaster command is cheap and does not require auth.
    client.admin.command('ping')
    print("✅ MongoDB Connected Successfully!")
except Exception as e:
    print(f"❌ MongoDB Connection Failed: {e}")

db = client.truthlens

def init_db():
    try:
        # Check if we can write
        db.command('ping')
        print("✅ Database Layer Initialized")
    except Exception as e:
        print(f"❌ Database Initialization Failed: {e}")
        return
        
    # Pre-fill Demo Users if they don't exist
    demo_users = [
        {'id': '1', 'name': 'Alex Johnson', 'email': 'alex@interviewer.com', 'password': 'demo123', 'role': 'interviewer', 'avatar': 'AJ', 'company': 'Enterprise Corp'},
        {'id': '2', 'name': 'Sam Williams', 'email': 'sam@candidate.com', 'password': 'demo123', 'role': 'candidate', 'avatar': 'SW', 'company': ''}
    ]
    
    for user_data in demo_users:
        email = user_data['email'].lower()
        if not db.users.find_one({'email': email}):
            user_doc = {
                'id': user_data['id'],
                'name': user_data['name'],
                'email': email,
                'password_hash': hash_password(user_data['password']),
                'role': user_data['role'],
                'avatar': user_data['avatar'],
                'company': user_data['company'],
                'created_at': datetime.now().isoformat(),
                'face_registered': 0,
                'face_image_base64': None
            }
            db.users.insert_one(user_doc)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def create_user(name, email, password, role, company="", user_id=None, face_registered=0, face_image_base64=None):
    uid = user_id if user_id else str(int(datetime.now().timestamp() * 1000))
    email_lower = email.lower()
    
    if db.users.find_one({'email': email_lower}):
        raise Exception("An account with this email already exists.")
        
    pwd_hash = hash_password(password)
    avatar = "".join([p[0] for p in name.strip().split()]).upper()[:2]
    created_at = datetime.now().isoformat()
    
    user_doc = {
        'id': uid,
        'name': name,
        'email': email_lower,
        'password_hash': pwd_hash,
        'role': role,
        'avatar': avatar,
        'company': company,
        'created_at': created_at,
        'face_registered': face_registered,
        'face_image_base64': face_image_base64
    }
    db.users.insert_one(user_doc)
    
    return {
        "id": uid,
        "name": name,
        "email": email_lower,
        "role": role,
        "avatar": avatar,
        "company": company,
        "createdAt": created_at
    }

def get_user_by_email_and_password(email, password):
    user = db.users.find_one({
        'email': email.lower(),
        'password_hash': hash_password(password)
    })
    if user:
        return {
            "id": user['id'],
            "name": user['name'],
            "email": user['email'],
            "role": user['role'],
            "avatar": user['avatar'],
            "company": user.get('company', ''),
            "createdAt": user['created_at'],
            "faceRegistered": bool(user.get('face_registered', 0))
        }
    return None

def get_user_by_email_only(email):
    user = db.users.find_one({'email': email.lower()})
    if user:
        return {
            "id": user['id'],
            "name": user['name'],
            "email": user['email'],
            "role": user['role'],
            "avatar": user['avatar'],
            "company": user.get('company', ''),
            "createdAt": user['created_at'],
            "faceRegistered": bool(user.get('face_registered', 0)),
            "faceImageBase64": user.get('face_image_base64')
        }
    return None

def get_all_face_records():
    """Returns a list of users with registered faces for global identification"""
    users = db.users.find({'face_registered': 1})
    records = []
    for u in users:
        records.append({
            'email': u['email'],
            'faceImageBase64': u.get('face_image_base64')
        })
    return records

def generate_token():
    return secrets.token_hex(32)

def create_session(code, session_id, position, interviewer):
    session_doc = {
        'code': code.upper(),
        'session_id': session_id,
        'created_at': datetime.now().isoformat(),
        'status': 'active',
        'candidate': 'Pending',
        'position': position,
        'interviewer': interviewer,
        'duration': 0,
        'scores': None,
        'report': None,
        'dominant_emotion': 'neutral'
    }
    db.sessions.insert_one(session_doc)

def get_session(code):
    session = db.sessions.find_one({'code': code.upper()})
    if session:
        return {
            "sessionCode": session['code'],
            "sessionId": session['session_id'],
            "createdAt": session['created_at'],
            "status": session['status'],
            "candidate": session['candidate'],
            "position": session['position'],
            "interviewer": session['interviewer'],
            "duration": session.get('duration', 0),
            "scores": session.get('scores'),
            "report": session.get('report'),
            "dominantEmotion": session.get('dominant_emotion', 'neutral')
        }
    return None

def get_all_sessions():
    sessions_cursor = db.sessions.find().sort('created_at', -1)
    sessions = []
    for s in sessions_cursor:
        sessions.append({
            "sessionCode": s['code'],
            "sessionId": s['session_id'],
            "createdAt": s['created_at'],
            "status": s['status'],
            "candidate": s['candidate'],
            "position": s['position'],
            "interviewer": s['interviewer'],
            "duration": s.get('duration', 0),
            "scores": s.get('scores'),
            "report": s.get('report'),
            "dominantEmotion": s.get('dominant_emotion', 'neutral')
        })
    return sessions

def update_session_candidate(code, candidate_name):
    db.sessions.update_one(
        {'code': code.upper()},
        {'$set': {'candidate': candidate_name, 'status': 'active'}}
    )

def save_session_results(code, results):
    db.sessions.update_one(
        {'code': code.upper()},
        {'$set': {
            'status': 'completed',
            'scores': results.get("aggregateStats", {}),
            'report': results,
            'dominant_emotion': results.get("aggregateStats", {}).get("dominantEmotion", 'neutral')
        }}
    )
