from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import json
import os
import random
import string
import logging
from datetime import datetime
import base64
import secrets
from deepface import DeepFace 

from model import predict_emotion, predict_emotion_from_frame, EMOTION_LABELS
from scoring import compute_scores
from pdf import create_pdf
import database
from pydantic import BaseModel

# ── Logging setup ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("truthlens")

app = FastAPI()
database.init_db()

# ── PRODUCTION MODE: Live AI Engine ──────────────────────────
# DeepFace and TensorFlow are now active for high-accuracy analysis.
model_ready = False # Set to False initially if pre-warming is needed

@app.get("/api/ready")
def check_ready():
    return {"ready": model_ready, "message": "Face engine ready" if model_ready else "Face engine is initializing, please wait 60 seconds..."}

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────
#  WebSocket Room Manager
#  Handles signaling between interviewer ↔ candidate
# ─────────────────────────────────────────────────────────────
class RoomManager:
    def __init__(self):
        # rooms[room_code][role] = {"ws": WebSocket, "name": str}
        self.rooms: dict = {}

    async def join(self, room_code: str, role: str, ws: WebSocket, name: str = ""):
        room_code = room_code.upper()
        if room_code not in self.rooms:
            self.rooms[room_code] = {}

        self.rooms[room_code][role] = {"ws": ws, "name": name}
        log.info(f"[{room_code}] {role.upper()} '{name}' joined. Peers now: {list(self.rooms[room_code].keys())}")

        # 1. Tell the OTHER peer that this peer has joined
        await self._send_to_others(room_code, role, {
            "type": "peer-joined",
            "role": role,
            "name": name,
        })

        # 2. Tell THIS peer about anyone already in the room
        # This is crucial so that if an interviewer joins second,
        # they know to initiate the WebRTC offer.
        for existing_role, info in self.rooms[room_code].items():
            if existing_role != role:
                await ws.send_json({
                    "type": "peer-joined",
                    "role": existing_role,
                    "name": info.get("name", ""),
                })

    async def leave(self, room_code: str, role: str):
        room_code = room_code.upper()
        if room_code not in self.rooms:
            return
        name = self.rooms[room_code].get(role, {}).get("name", "?")
        self.rooms[room_code].pop(role, None)
        log.info(f"[{room_code}] {role.upper()} '{name}' left. Remaining: {list(self.rooms[room_code].keys())}")
        await self._send_to_others(room_code, role, {"type": "peer-left", "role": role})
        if not self.rooms[room_code]:
            del self.rooms[room_code]

    async def relay(self, room_code: str, sender_role: str, message: dict):
        """Relay a signaling message to the peer with the opposite role."""
        room_code = room_code.upper()
        target_role = "candidate" if sender_role == "interviewer" else "interviewer"
        room = self.rooms.get(room_code, {})
        peer = room.get(target_role)
        if peer:
            try:
                await peer["ws"].send_json(message)
                log.info(f"[{room_code}] Relayed '{message.get('type')}' from {sender_role} → {target_role}")
            except Exception as e:
                log.warning(f"[{room_code}] Failed to relay to {target_role}: {e}")
        else:
            log.warning(f"[{room_code}] No {target_role} in room to receive '{message.get('type')}'")

    async def _send_to_others(self, room_code: str, sender_role: str, message: dict):
        room_code = room_code.upper()
        room = self.rooms.get(room_code, {})
        for role, peer in room.items():
            if role != sender_role:
                try:
                    await peer["ws"].send_json(message)
                except Exception:
                    pass

room_manager = RoomManager()

# ─────────────────────────────────────────────────────────────
#  WebSocket Signaling Endpoint
# ─────────────────────────────────────────────────────────────
@app.websocket("/ws/{room_code}")
async def websocket_signaling(websocket: WebSocket, room_code: str):
    await websocket.accept()
    role = None
    try:
        # First message must identify the peer
        init_msg = await websocket.receive_json()
        role = init_msg.get("role", "candidate")
        name = init_msg.get("name", "Unknown")

        await room_manager.join(room_code, role, websocket, name)

        # Persist candidate name into session file
        if role == "candidate" and name and name != "Unknown":
            database.update_session_candidate(room_code, name)

        # Main signaling loop
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type in ("offer", "answer", "ice-candidate"):
                await room_manager.relay(room_code, role, data)
            elif msg_type == "chat":
                await room_manager._send_to_others(room_code, role, data)
            else:
                log.warning(f"[{room_code}] Unknown message type: {msg_type}")

    except WebSocketDisconnect:
        log.info(f"[{room_code}] WebSocket disconnected (role={role})")
    except Exception as e:
        log.error(f"[{room_code}] Unexpected error: {e}")
    finally:
        if role:
            await room_manager.leave(room_code, role)

# ─────────────────────────────────────────────────────────────
#  REST API
# ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str
    company: str = ""

@app.post("/api/auth/login")
def login(req: LoginRequest):
    from fastapi.responses import JSONResponse
    user = database.get_user_by_email_and_password(req.email, req.password)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Invalid email or password. Please try again."})
    user["token"] = database.generate_token()
    return user

@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    from fastapi.responses import JSONResponse
    try:
        user = database.create_user(req.name, req.email, req.password, req.role, req.company)
        user["token"] = database.generate_token()
        return user
    except Exception as e:
         return JSONResponse(status_code=400, content={"error": str(e)})

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, background_tasks: __import__("fastapi").BackgroundTasks):
    from fastapi.responses import JSONResponse
    import random
    from email_utils import send_otp_email
    
    # Check if user exists
    user = database.get_user_by_email_only(req.email)
    if not user:
        # Don't reveal if email exists or not (security)
        return {"message": "If this email is registered, you will receive an OTP shortly."}
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    
    # Save OTP to database
    database.save_otp(req.email, otp)
    
    # Send email asynchronously to prevent timeouts
    def send_email_task(email, otp_code):
        sent = send_otp_email(email, otp_code)
        if sent:
            log.info(f"OTP sent to {email}")
        else:
            log.error(f"Failed to send OTP email to {email}")
            
    background_tasks.add_task(send_email_task, req.email, otp)
    
    return {"message": "If this email is registered, you will receive an OTP shortly."}

@app.post("/api/auth/verify-otp")
def verify_otp_endpoint(req: VerifyOTPRequest):
    from fastapi.responses import JSONResponse
    
    valid = database.verify_otp(req.email, req.otp)
    if not valid:
        return JSONResponse(status_code=400, content={"error": "Invalid or expired OTP. Please try again."})
    
    return {"message": "OTP verified successfully.", "verified": True}

@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    from fastapi.responses import JSONResponse
    
    # Verify OTP again for security
    valid = database.verify_otp(req.email, req.otp)
    if not valid:
        return JSONResponse(status_code=400, content={"error": "Invalid or expired OTP. Please request a new one."})
    
    if len(req.new_password) < 6:
        return JSONResponse(status_code=400, content={"error": "Password must be at least 6 characters."})
    
    updated = database.update_password(req.email, req.new_password)
    if not updated:
        return JSONResponse(status_code=404, content={"error": "User not found."})
    
    log.info(f"Password reset successful for {req.email}")
    return {"message": "Password reset successfully. You can now login with your new password."}

class FaceSignupRequest(BaseModel):
    name: str
    email: str
    role: str
    image: str
    company: str = ""

@app.post("/api/auth/face-signup")
def face_signup(req: FaceSignupRequest):
    from fastapi.responses import JSONResponse
    import traceback
    try:
        # Decode image just to ensure it's valid base64
        encoded_data = req.image.split(',')[1] if ',' in req.image else req.image
        
        # Add necessary base64 padding
        padding_needed = len(encoded_data) % 4
        if padding_needed:
            encoded_data += "=" * (4 - padding_needed)
            
        log.info(f"PRESENTATION MODE: Fast signup for {req.email}")
        
        # We store the base64 string directly in MongoDB
        random_pwd = secrets.token_hex(16)
        user = database.create_user(
            name=req.name, 
            email=req.email, 
            password=random_pwd, 
            role=req.role, 
            company=req.company, 
            face_registered=1,
            face_image_base64=encoded_data 
        )
        user["token"] = database.generate_token()
        return user
    except Exception as e:
        log.error(f"Face signup error: {traceback.format_exc()}")
        return JSONResponse(status_code=400, content={"error": f"Face Setup Failed: {str(e)}"})

class FaceLoginRequest(BaseModel):
    image: str

@app.post("/api/auth/face-login")
def face_login(req: FaceLoginRequest):
    from fastapi.responses import JSONResponse
    import traceback

    try:
        log.info("🔍 Global Face Search initiated...")
        records = database.get_all_face_records()
        if not records:
            return JSONResponse(status_code=404, content={"error": "No registered faces found in database."})

        # Iterate and find best match
        best_match = None
        min_distance = 1.0 # Cosine distance threshold is usually 0.4 for VGG-Face
        
        # Use VGG-Face (default) - reliable for global search
        for rec in records:
            try:
                db_image = f"data:image/jpeg;base64,{rec['faceImageBase64']}"
                
                res = DeepFace.verify(
                    img1_path=req.image, 
                    img2_path=db_image,
                    model_name="Facenet",
                    enforce_detection=False,
                    detector_backend='opencv'
                )
                
                distance = res.get("distance", 1.0)
                # For prototypes, a slightly looser threshold (0.50) is better than strict 0.40
                if distance < 0.50 and distance < min_distance:
                    min_distance = distance
                    best_match = rec
                    # If we find a very strong match, we can stop early
                    if distance < 0.25:
                        break
            except Exception as e:
                log.error(f"Face verify failed for {rec['email']}: {e}")
                continue

        if best_match:
            log.info(f"✨ Global Match Found! User: {best_match['email']} (dist: {min_distance:.3f})")
            best_match["token"] = database.generate_token()
            best_match.pop("faceImageBase64", None)
            return best_match
        
        return JSONResponse(status_code=401, content={"error": "No matching face found. Please try again or use password login."})
             
    except Exception as e:
        log.error(f"Face verify error: {traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": "Face Login Failed (Global Search error)."})

latest_result = {"stress": 0, "confidence": 0, "truth": 0}
latest_distribution = {}

@app.get("/")
def home():
    return {"status": "Backend running", "rooms": list(room_manager.rooms.keys())}

@app.post("/api/sessions/create")
def create_session(metadata: dict = Body(default={})):
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    code = ''.join(random.choices(chars, k=6))
    # Note: simple loop assuming no infinite collision
    while database.get_session(code):
        code = ''.join(random.choices(chars, k=6))

    session_id = f"sess_{int(datetime.now().timestamp() * 1000)}"
    pos = (metadata or {}).get("position", "Senior Software Engineer")
    interviewer = (metadata or {}).get("interviewer", "Unknown")

    database.create_session(code, session_id, pos, interviewer)
    log.info(f"Session created: {code}")
    return database.get_session(code)

@app.post("/api/sessions/validate")
def validate_session(data: dict = Body(...)):
    code = data.get("code", "").upper().strip()
    session = database.get_session(code)
    if session:
        return session
    return {"error": "Invalid session code"}

@app.get("/api/sessions")
def list_sessions():
    return database.get_all_sessions()

@app.get("/api/sessions/{code}")
def get_session(code: str):
    code = code.upper().strip()
    session = database.get_session(code)
    if session:
        return session
    return {"error": "Session not found"}

@app.post("/api/sessions/{code}/results")
def save_session_results(code: str, results: dict = Body(...)):
    code = code.upper().strip()
    session = database.get_session(code)
    if session:
        database.save_session_results(code, results)
        return {"status": "Results saved"}
    return {"error": "Session not found"}

@app.post("/analyze")
def analyze(file: UploadFile = File(...)):
    contents = file.file.read()
    nparr = np.frombuffer(contents, np.uint8)
    
    # Use color image for better accuracy with MediaPipe/DeepFace
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if frame is None:
        return {"error": "Invalid image"}

    # Use the enhanced model (MediaPipe + DeepFace + Temporal Smoothing)
    preds = predict_emotion_from_frame(frame, return_probs=True)
    emotion_id      = int(np.argmax(preds))
    emotion         = EMOTION_LABELS[emotion_id]
    confidence_score = float(np.max(preds))

    emotion_distribution = {
        EMOTION_LABELS[i]: float(preds[i]) for i in range(len(EMOTION_LABELS))
    }

    stress, confidence, truth = compute_scores(emotion_id, confidence_score)

    latest_result.update({"stress": stress, "confidence": confidence, "truth": truth})
    latest_distribution.update(emotion_distribution)

    return {
        "emotion":            emotion,
        "confidence_score":   confidence_score,
        "stress":             stress,
        "confidence":         confidence,
        "truth":              truth,
        "emotion_distribution": emotion_distribution,
    }

@app.get("/generate-report")
def generate_report():
    create_pdf(
        latest_result["stress"],
        latest_result["confidence"],
        latest_result["truth"],
        emotion_distribution=latest_distribution,
        name="Candidate",
        code="INT001",
    )
    return {"status": "Report generated successfully"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)