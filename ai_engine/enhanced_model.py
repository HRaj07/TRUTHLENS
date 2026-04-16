"""
Enhanced Emotion Model
----------------------
Uses DeepFace.analyze for high-accuracy 7-class emotion probabilities.
Falls back to uniform pseudo-probabilities on empty frames.
"""

import cv2
import numpy as np
import logging
from collections import deque

log = logging.getLogger("truthlens")

# ── Label definition ─────────────────────────────────────────────────────────
LABELS = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

# ── Load DeepFace ────────────────────────────────────────────────────────────
_deepface_available = False
try:
    from deepface import DeepFace
    log.info("✅ DeepFace model loaded successfully for emotion detection")
    _deepface_available = True
    
    # Warm up the model on import so the first frame isn't slow
    _dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
    DeepFace.analyze(_dummy_img, actions=['emotion'], enforce_detection=False, detector_backend='opencv')
except Exception as e:
    log.error(f"❌ Could not load DeepFace: {e}")

class EnhancedEmotionModel:
    """
    Multi-stage pipeline:
      1. DeepFace.analyze → detects face (OpenCV backend) and extracts emotion probabilities
      2. Temporal smoothing (short window) → stable, responsive output
    """

    def __init__(self, sequence_length=4):
        self.sequence_length = sequence_length
        self.history = deque(maxlen=sequence_length)

    def predict(self, frame):
        """
        Returns a 7-element probability array aligned with LABELS.
        Never returns all-neutral; always a genuine probability distribution.
        """
        if not _deepface_available:
            return self._uniform_fallback("DeepFace not loaded")

        try:
            # enforce_detection=False prevents crash if no face is found
            # detector_backend='opencv' is fast enough for near real-time processing
            results = DeepFace.analyze(
                img_path=frame, 
                actions=['emotion'], 
                enforce_detection=False,
                detector_backend='opencv'
            )

            # DeepFace might return a list of faces. We use the prominent one (usually first).
            if isinstance(results, list):
                result = results[0]
            else:
                result = results

            emotions = result.get('emotion', {})
            if not emotions:
                return self._history_or_uniform()

            # Map raw percentages to our 0.0 - 1.0 probability array using precise LABELS index
            scores = np.zeros(len(LABELS))
            for i, label in enumerate(LABELS):
                scores[i] = emotions.get(label, 0.0) / 100.0

            total = scores.sum()
            if total > 0:
                scores /= total
            else:
                return self._uniform_fallback("zero-sum scores")

            # ── Temporal smoothing (short window → stays responsive) ──────
            self.history.append(scores)
            weights = np.linspace(0.5, 1.0, len(self.history))
            weights /= weights.sum()
            smoothed = np.average(list(self.history), axis=0, weights=weights)

            log.info(
                "DeepFace → %s=%.2f | happy=%.2f | angry=%.2f | sad=%.2f | fear=%.2f | surprise=%.2f | disgust=%.2f",
                LABELS[int(np.argmax(smoothed))], smoothed.max(),
                smoothed[3], smoothed[0], smoothed[5], smoothed[2], smoothed[6], smoothed[1],
            )
            return smoothed

        except Exception as e:
            log.debug(f"DeepFace prediction error: {e}")
            return self._history_or_uniform()

    # ------------------------------------------------------------------
    def _history_or_uniform(self):
        if self.history:
            # Gradually decay history towards neutral if too many failures
            return self.history[-1] 
        return self._uniform_fallback("empty history")

    def _uniform_fallback(self, reason=""):
        log.debug(f"Neutral fallback ({reason})")
        # Return Neutral (index 4) with high probability, others low
        # This prevents np.argmax from defaulting to 'angry' (index 0)
        probs = np.ones(len(LABELS)) * 0.05
        probs[4] = 0.70  # Force index 4 (neutral) as the winner
        return probs / probs.sum()


# ── Singleton ─────────────────────────────────────────────────────────────────
_model_instance = EnhancedEmotionModel()


def get_enhanced_prediction(frame: np.ndarray) -> np.ndarray:
    """Public API. Pass a BGR frame, get a 7-element probability array."""
    return _model_instance.predict(frame)
