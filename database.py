import sqlite3
import os
import json
import hashlib
import secrets
from datetime import datetime

DB_PATH = "data/truthlens.db"

def init_db():
    os.makedirs("data", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    # Users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT UNIQUE,
            password_hash TEXT,
            role TEXT,
            avatar TEXT,
            company TEXT,
            created_at TEXT,
            face_registered INTEGER DEFAULT 0
        )
    ''')
    try:
        c.execute('ALTER TABLE users ADD COLUMN face_registered INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    # Sessions table
    c.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            code TEXT PRIMARY KEY,
            session_id TEXT,
            created_at TEXT,
            status TEXT,
            candidate TEXT,
            position TEXT,
            interviewer TEXT,
            duration INTEGER,
            scores TEXT,
            report TEXT,
            dominant_emotion TEXT
        )
    ''')
    
    # Pre-fill Demo Users if they don't exist
    demo_users = [
        ('1', 'Alex Johnson', 'alex@interviewer.com', 'demo123', 'interviewer', 'AJ', 'FAANG Corp'),
        ('2', 'Sam Williams', 'sam@candidate.com', 'demo123', 'candidate', 'SW', '')
    ]
    
    for uid, name, email, password, role, avatar, company in demo_users:
        if not _user_exists_raw(c, email):
            c.execute('''
                INSERT INTO users (id, name, email, password_hash, role, avatar, company, created_at, face_registered)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
            ''', (uid, name, email, hash_password(password), role, avatar, company, datetime.now().isoformat()))

    conn.commit()
    conn.close()

def _user_exists_raw(cursor, email):
    cursor.execute('SELECT id FROM users WHERE email = ?', (email.lower(),))
    return cursor.fetchone() is not None

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def create_user(name, email, password, role, company="", user_id=None, face_registered=0):
    uid = user_id if user_id else str(int(datetime.now().timestamp() * 1000))
    pwd_hash = hash_password(password)
    avatar = "".join([p[0] for p in name.strip().split()]).upper()[:2]
    created_at = datetime.now().isoformat()
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        c.execute('''
            INSERT INTO users (id, name, email, password_hash, role, avatar, company, created_at, face_registered)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (uid, name, email.lower(), pwd_hash, role, avatar, company, created_at, face_registered))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise Exception("An account with this email already exists.")
    conn.close()
    
    return {
        "id": uid,
        "name": name,
        "email": email.lower(),
        "role": role,
        "avatar": avatar,
        "company": company,
        "createdAt": created_at
    }

def get_user_by_email_and_password(email, password):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, name, email, role, avatar, company, created_at, face_registered FROM users WHERE email = ? AND password_hash = ?', 
              (email.lower(), hash_password(password)))
    row = c.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "role": row[3],
            "avatar": row[4],
            "company": row[5],
            "createdAt": row[6],
            "faceRegistered": bool(row[7])
        }
    return None

def get_user_by_email_only(email):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, name, email, role, avatar, company, created_at, face_registered FROM users WHERE email = ?', 
              (email.lower(),))
    row = c.fetchone()
    conn.close()
    if row:
        return {
            "id": row[0],
            "name": row[1],
            "email": row[2],
            "role": row[3],
            "avatar": row[4],
            "company": row[5],
            "createdAt": row[6],
            "faceRegistered": bool(row[7])
        }
    return None

def generate_token():
    return secrets.token_hex(32)

def create_session(code, session_id, position, interviewer):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        INSERT INTO sessions (code, session_id, created_at, status, candidate, position, interviewer)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (code, session_id, datetime.now().isoformat(), 'active', 'Pending', position, interviewer))
    conn.commit()
    conn.close()

def get_session(code):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT * FROM sessions WHERE code = ?', (code.upper(),))
    row = c.fetchone()
    conn.close()
    if row:
        return {
            "sessionCode": row[0],
            "sessionId": row[1],
            "createdAt": row[2],
            "status": row[3],
            "candidate": row[4],
            "position": row[5],
            "interviewer": row[6],
            "duration": row[7],
            "scores": json.loads(row[8]) if row[8] else None,
            "report": json.loads(row[9]) if row[9] else None,
            "dominantEmotion": row[10]
        }
    return None

def get_all_sessions():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT * FROM sessions ORDER BY created_at DESC')
    rows = c.fetchall()
    conn.close()
    
    sessions = []
    for row in rows:
        sessions.append({
            "sessionCode": row[0],
            "sessionId": row[1],
            "createdAt": row[2],
            "status": row[3],
            "candidate": row[4],
            "position": row[5],
            "interviewer": row[6],
            "duration": row[7],
            "scores": json.loads(row[8]) if row[8] else None,
            "report": json.loads(row[9]) if row[9] else None,
            "dominantEmotion": row[10]
        })
    return sessions

def update_session_candidate(code, candidate_name):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('UPDATE sessions SET candidate = ?, status = ? WHERE code = ?', 
              (candidate_name, 'active', code.upper()))
    conn.commit()
    conn.close()

def save_session_results(code, results):
    scores_json = json.dumps(results.get("aggregateStats", {}))
    report_json = json.dumps(results)
    dominant_emotion = results.get("aggregateStats", {}).get("dominantEmotion")
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        UPDATE sessions 
        SET status = ?, scores = ?, report = ?, dominant_emotion = ?
        WHERE code = ?
    ''', ('completed', scores_json, report_json, dominant_emotion, code.upper()))
    conn.commit()
    conn.close()
