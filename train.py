import os
import cv2
import numpy as np

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Flatten, Dense, Dropout, TimeDistributed, LSTM
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.regularizers import l2
from tensorflow.keras.utils import to_categorical
from sklearn.utils.class_weight import compute_class_weight

# ================= SETTINGS =================
IMG_SIZE = 48
SEQUENCE_LENGTH = 10

emotion_labels = ['angry','disgust','fear','happy','neutral','sad','surprise']

# ================= LOAD DATA =================
def load_dataset(path):
    X, y = [], []

    print(f"\n📂 Loading: {path}")

    for label, emotion in enumerate(emotion_labels):
        folder = os.path.join(path, emotion)

        if not os.path.exists(folder):
            print(f"❌ Missing: {folder}")
            continue

        for img_name in os.listdir(folder):
            img_path = os.path.join(folder, img_name)

            try:
                img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
                img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))

                # ---- SIMPLE AUGMENTATION ----
                if np.random.rand() > 0.5:
                    img = cv2.flip(img, 1)

                img = img / 255.0

                X.append(img)
                y.append(label)

            except:
                continue

        print(f"✅ {emotion} loaded")

    return X, y


print("🚀 Loading ALL datasets...")

X, y = [], []

# CK+
x1, y1 = load_dataset("data/ckplus/CK+48")
X += x1
y += y1

# FER2013
x2, y2 = load_dataset("data/fer2013/fer2013/train")
X += x2
y += y2

# RAF-DB
x3, y3 = load_dataset("data/rafdb/raf-db-dataset/DATASET/train")
X += x3
y += y3

X = np.array(X)
y = np.array(y)

print(f"\n🔥 TOTAL SAMPLES: {len(X)}")

# ================= PREPROCESS =================
X = X.reshape(-1, IMG_SIZE, IMG_SIZE, 1)

# 🔥 Create SEQUENCE (simulate video)
X = np.repeat(X[:, np.newaxis, :, :, :], SEQUENCE_LENGTH, axis=1)

y = to_categorical(y, num_classes=len(emotion_labels))

# ================= CLASS WEIGHTS =================
class_weights = compute_class_weight(
    class_weight='balanced',
    classes=np.unique(np.argmax(y, axis=1)),
    y=np.argmax(y, axis=1)
)
class_weights = dict(enumerate(class_weights))

# ================= MODEL =================
def build_model():
    model = Sequential()

    # CNN part
    model.add(TimeDistributed(
        Conv2D(32, (3,3), activation='relu', kernel_regularizer=l2(0.001)),
        input_shape=(SEQUENCE_LENGTH,48,48,1)
    ))
    model.add(TimeDistributed(MaxPooling2D(2,2)))

    model.add(TimeDistributed(
        Conv2D(64, (3,3), activation='relu', kernel_regularizer=l2(0.001))
    ))
    model.add(TimeDistributed(MaxPooling2D(2,2)))

    model.add(TimeDistributed(
        Conv2D(128, (3,3), activation='relu', kernel_regularizer=l2(0.001))
    ))
    model.add(TimeDistributed(MaxPooling2D(2,2)))

    model.add(TimeDistributed(Flatten()))

    # LSTM part
    model.add(LSTM(128))
    model.add(Dropout(0.5))

    model.add(Dense(64, activation='relu'))
    model.add(Dropout(0.3))

    model.add(Dense(len(emotion_labels), activation='softmax'))

    return model


model = build_model()

model.compile(
    optimizer=Adam(learning_rate=0.0003),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

# ================= CALLBACK =================
early_stop = EarlyStopping(
    monitor='loss',
    patience=3,
    restore_best_weights=True
)

# ================= TRAIN =================
print("\n🔥 Training started...")

model.fit(
    X, y,
    epochs=25,
    batch_size=16,
    class_weight=class_weights,
    callbacks=[early_stop]
)

# ================= SAVE =================
os.makedirs("model", exist_ok=True)
model.save("model/emotion_model.h5")

print("\n✅ Training complete & model saved!") 