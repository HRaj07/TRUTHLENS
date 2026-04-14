
import cv2
import numpy as np
from tensorflow.keras.models import load_model

model = load_model("model/cnn_lstm.h5")
buffer = []

def predict(frame):
    global buffer

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    face = cv2.resize(gray,(48,48))/255.0
    face = face.reshape(48,48,1)

    buffer.append(face)

    if len(buffer)<10:
        return None

    if len(buffer)>10:
        buffer.pop(0)

    seq = np.array(buffer).reshape(1,10,48,48,1)
    pred = model.predict(seq)[0]

    return pred
