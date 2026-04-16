import cv2
import numpy as np
import os
from tensorflow.keras.models import load_model

# Load model and labels
model_path = "model/emotion_model_best.keras"
labels = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

if not os.path.exists(model_path):
    print(f"❌ Model weight not found at {model_path}")
    exit(1)

model = load_model(model_path)

# Load image
img_path = "candidate.jpg"
if not os.path.exists(img_path):
    print(f"❌ Image not found at {img_path}")
    exit(1)

image = cv2.imread(img_path)
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
face = cv2.resize(gray, (48, 48))
face = face / 255.0
face = np.reshape(face, (1, 48, 48, 1))

# Predict
pred = model.predict(face, verbose=0)
emotion = labels[np.argmax(pred)]
conf = np.max(pred)

# Annotate
text = f"Emotion: {emotion} ({conf*100:.1f}%)"
cv2.putText(image, text, (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 0), 3)

# Save result
out_path = "TruthLens_Submission/results/sample_prediction.jpg"
cv2.imwrite(out_path, image)
print(f"✅ Sample prediction saved to {out_path}")
