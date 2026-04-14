def compute_scores(emotion_id, confidence_score=0.5):
    """
    emotion_id → index (0–6)
    confidence_score → model confidence (0–1)
    """

    # Emotion-based base stress
    stress_base = {
        0: 0.8,  # angry
        1: 0.7,  # disgust
        2: 0.9,  # fear
        3: 0.2,  # happy
        4: 0.3,  # neutral
        5: 0.7,  # sad
        6: 0.4   # surprise
    }

    # Base confidence by emotion
    confidence_base = {
        0: 0.3,
        1: 0.4,
        2: 0.2,
        3: 0.9,
        4: 0.7,
        5: 0.4,
        6: 0.6
    }

    # Get base values
    stress = stress_base.get(emotion_id, 0.5)
    confidence = confidence_base.get(emotion_id, 0.5)

    # 🔥 Adjust using model confidence
    confidence = (confidence + confidence_score) / 2

    # Stress reduces if model confident
    stress = stress * (1 - confidence_score * 0.5)

    # 🎯 Truth score (bounded 0–1)
    truth = max(0.0, min(1.0, confidence - stress))

    return round(stress, 3), round(confidence, 3), round(truth, 3)