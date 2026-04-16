import os
import cv2
import numpy as np

# Try MLX first (faster)
mlx_available = False
if os.path.exists("model/emotion_model_best_mlx.npz"):
    try:
        import mlx.core as mx
        from ai_engine.mlx_cnn_lstm_model import MLXTruthLensModel
        model = MLXTruthLensModel()
        model.load_weights("model/emotion_model_best_mlx.npz")
        model.eval()
        mlx_available = True
    except ImportError:
        pass

# Fallback to Keras
if not mlx_available:
    try:
        from tensorflow.keras.models import load_model
        model = load_model("model/emotion_model_best.keras")
    except Exception:
        model = None

buffer = []

# Temporal Smoothing & Threshold state
ema_probs = None
ALPHA = 0.3  # EMA smoothing factor (lower = smoother)
CONFIDENCE_THRESHOLD = 0.4
last_emotion_pred = None

# Load Haar cascade for face detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def predict(frame):
    global buffer

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    
    if len(faces) == 0:
        # If no face is detected, we return Neutral (index 4) to keep the UI calm
        neutral_probs = np.ones(7) * 0.05
        neutral_probs[4] = 0.70
        return neutral_probs / neutral_probs.sum()
    else:
        # Get primary face (largest)
        faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
        x, y, w, h = faces[0]
        
        # Add 15% padding
        pad_w = int(w * 0.15)
        pad_h = int(h * 0.15)
        
        # Ensure we don't go out of frame bounds
        y_start = max(0, y - pad_h)
        y_end = min(gray.shape[0], y + h + pad_h)
        x_start = max(0, x - pad_w)
        x_end = min(gray.shape[1], x + w + pad_w)
        
        face_crop = gray[y_start:y_end, x_start:x_end]
        face_resized = cv2.resize(face_crop, (48, 48)) / 255.0
        face_resized = face_resized.reshape(48, 48, 1)

        buffer.append(face_resized)

    if len(buffer) < 10:
        return None

    if len(buffer) > 10:
        buffer.pop(0)

    if model is None:
        return None

    def _apply_smoothing_and_threshold(raw_pred):
        global ema_probs, last_emotion_pred
        
        # 1. Temporal Smoothing (EMA)
        if ema_probs is None:
            ema_probs = raw_pred
        else:
            ema_probs = (ALPHA * raw_pred) + ((1 - ALPHA) * ema_probs)
            
        ema_probs /= ema_probs.sum() # renormalize
        
        # 2. Confidence Thresholding
        max_prob = np.max(ema_probs)
        current_pred_idx = np.argmax(ema_probs)
        
        # Output is still probability array, but internally we logically hold
        # However, the public API of predictor returns the raw 7-item array,
        # so we will return the smoothed probabilities. The UI uses max probability.
        
        if max_prob < CONFIDENCE_THRESHOLD and last_emotion_pred is not None:
            # If we are unconfident, pull probabilities toward the last known stable state
            stable_probs = np.zeros(7)
            stable_probs[last_emotion_pred] = 1.0
            # Blend heavily with the stable state
            ema_probs = (0.2 * ema_probs) + (0.8 * stable_probs)
        else:
            # We are confident, update stable state
            last_emotion_pred = current_pred_idx
            
        return ema_probs

    if mlx_available:
        try:
            seq = mx.array(np.array(buffer).reshape(1, 10, 48, 48, 1))
            pred = mx.softmax(model(seq), axis=-1)[0]
            return _apply_smoothing_and_threshold(np.array(pred))
        except Exception:
            return None
    else:
        try:
            seq = np.array(buffer).reshape(1, 10, 48, 48, 1)
            pred = model.predict(seq, verbose=0)[0]
            return _apply_smoothing_and_threshold(pred)
        except Exception:
            return None
