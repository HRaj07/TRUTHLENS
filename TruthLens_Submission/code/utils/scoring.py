
def compute_scores(e):
    stress = e[2] + e[4]
    confidence = e[3] + e[6]
    truth = confidence - stress
    return stress, confidence, truth
