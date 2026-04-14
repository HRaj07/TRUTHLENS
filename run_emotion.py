import cv2
import numpy as np
import sys
from tensorflow.keras.models import load_model
from utils.report import generate_report

# INPUTS
name = sys.argv[1] if len(sys.argv) > 1 else "Candidate"
code = sys.argv[2] if len(sys.argv) > 2 else "NA"

model = load_model("model/emotion_model.h5")
labels = ['angry','disgust','fear','happy','neutral','sad','surprise']

cap = cv2.VideoCapture(0)

emotion_log = []
truth = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    face = cv2.resize(gray, (48,48))
    face = face / 255.0
    face = np.reshape(face, (1,48,48,1))

    pred = model.predict(face, verbose=0)
    emotion = labels[np.argmax(pred)]
    conf = np.max(pred)

    emotion_log.append(emotion)

    if emotion in ["happy","neutral"]:
        truth += 1

    cv2.putText(frame, f"{emotion} {conf:.2f}", (10,30),
                cv2.FONT_HERSHEY_SIMPLEX,1,(0,255,0),2)

    cv2.imshow("Interview", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

final_emotion = max(set(emotion_log), key=emotion_log.count)
truth_score = (truth / len(emotion_log)) * 100

generate_report(name, code, emotion_log, final_emotion, truth_score, "N/A")

print("Report Generated") 