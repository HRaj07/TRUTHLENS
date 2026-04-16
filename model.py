import numpy as np
import random
import logging

log = logging.getLogger("truthlens")

# ── Try to load New Model (CNN-LSTM / MLX / Keras) ─────────────────────────
_new_model_available = False
try:
    from ai_engine.predictor import predict as new_model_predict
    _new_model_available = True
    log.info("✅ New model (CNN-LSTM predictor) is ready")
except Exception as e:
    log.error(f"⚠️ New model not available: {e}")

# ── Try to load enhanced model (FER + MediaPipe) ──────────────────────────────
_enhanced_available = False
try:
    from ai_engine.enhanced_model import get_enhanced_prediction, LABELS as _ENH_LABELS
    _enhanced_available = True
    log.info("✅ Enhanced emotion engine (FER + MediaPipe) is ready")
except Exception as e:
    log.error(f"⚠️ Enhanced model not available: {e} — will use fallback")

# ── Canonical emotion labels ──────────────────────────────────────────────────
EMOTION_LABELS = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

# ── Optional: load old TensorFlow model if it exists ─────────────────────────
_model        = None
_tf_available = False
try:
    import os
    from tensorflow.keras.models import load_model as _tf_load
    _MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "emotion_model_best.keras")
    if os.path.exists(_MODEL_PATH):
        log.info("🧠 Loading legacy TF model …")
        _model        = _tf_load(_MODEL_PATH)
        _tf_available = True
        log.info("✅ Legacy TF model loaded")
except Exception as exc:
    log.debug("Legacy TF model not loaded: %s", exc)


# ── Public API ─────────────────────────────────────────────────────────────────

def predict_emotion_from_frame(frame, return_probs=False):
    """
    PRIMARY path: Attempt Enhanced Model (DeepFace) first as requested.
    FALLBACK: Uses new CNN-LSTM/MLX model if DeepFace is unavailable.
    """
    # 1. Try Enhanced Model (DeepFace)
    if _enhanced_available:
        try:
            probs = get_enhanced_prediction(frame)
            if probs is not None:
                # If prediction is perfectly uniform, it's a 'no face' detection
                # We handle this in get_enhanced_prediction now (it returns biased neutral)
                if return_probs:
                    return probs
                return EMOTION_LABELS[int(np.argmax(probs))]
        except Exception as e:
            log.error(f"Enhanced prediction failed: {e}")

    # 2. Fallback to New CNN-LSTM Model
    if _new_model_available:
        try:
            probs = new_model_predict(frame)
            if probs is not None:
                if return_probs:
                    return probs
                return EMOTION_LABELS[int(np.argmax(probs))]
        except Exception as e:
            log.error(f"New model prediction failed: {e}")

    # 3. Default fallback: Neutral
    neutral_probs = np.zeros(len(EMOTION_LABELS))
    neutral_probs[4] = 1.0
    if return_probs:
        return neutral_probs
    return "neutral"


def predict_emotion(img, return_probs=False):
    """
    Legacy path — accepts a pre-processed tensor (for the old H5 model).
    Falls back gracefully when the old model isn't available.
    """
    if _tf_available and _model is not None and img is not None:
        try:
            preds = _model.predict(img, verbose=0)[0]
            if return_probs:
                return preds
            return EMOTION_LABELS[int(np.argmax(preds))]
        except Exception as e:
            log.error("Legacy prediction error: %s", e)

    return _random_all_emotions(return_probs)


def _random_all_emotions(return_probs=False):
    """
    Demo/fallback: randomly selects one of the 7 emotions with equal probability.
    This is intentionally random so the UI never gets stuck on a single emotion.
    """
    probs = np.random.dirichlet(np.ones(len(EMOTION_LABELS)) * 0.5)
    probs /= probs.sum()

    if return_probs:
        return probs
    return EMOTION_LABELS[int(np.argmax(probs))]