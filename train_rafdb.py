import os
import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import (
    EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
)
from tensorflow.keras.utils import Sequence, to_categorical
from tensorflow.keras.losses import CategoricalCrossentropy

from ai_engine.cnn_lstm_model import build_model

# =====================================================================
# SETTINGS
# =====================================================================
IMG_SIZE        = 48
SEQUENCE_LENGTH = 10
BATCH_SIZE      = 16
EPOCHS          = 80
LABEL_SMOOTHING = 0.1

emotion_labels = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

# RAF-DB mapping for test folders (1-7) to canonical string labels
RAF_TEST_MAP = {
    '1': 'surprise',
    '2': 'fear',
    '3': 'disgust',
    '4': 'happy',
    '5': 'sad',
    '6': 'angry',
    '7': 'neutral'
}

# =====================================================================
# DATA LOADING
# =====================================================================

def load_rafdb_data(target_dir, is_test=False, seq_len=10):
    """
    Loads RAF-DB data from directories.
    If is_test=True, it expects subfolders named 1-7 mapped via RAF_TEST_MAP.
    If is_test=False, it expects canonical subfolders (angry, fear, etc.).
    Static images are repeated seq_len times to support the CNN-LSTM.
    """
    sequences, labels = [], []
    
    if not os.path.exists(target_dir):
        print(f"Directory not found: {target_dir}")
        return sequences, labels

    out_label_idx_map = {name: idx for idx, name in enumerate(emotion_labels)}

    for folder in os.listdir(target_dir):
        folder_path = os.path.join(target_dir, folder)
        if not os.path.isdir(folder_path):
            continue

        if is_test:
            if folder not in RAF_TEST_MAP:
                continue
            emotion_name = RAF_TEST_MAP[folder]
        else:
            emotion_name = folder
            if emotion_name not in emotion_labels:
                continue

        label_idx = out_label_idx_map[emotion_name]

        # Read images
        for fname in sorted(os.listdir(folder_path)):
            if not fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            
            img_path = os.path.join(folder_path, fname)
            # Repeat the same image seq_len times to create a pseudo-sequence
            sequences.append([img_path] * seq_len)
            labels.append(label_idx)

    return sequences, labels

# =====================================================================
# AUGMENTATION
# =====================================================================

def _augment_frame(img, img_size, strength=1.0):
    # Horizontal flip
    if np.random.rand() > 0.5:
        img = cv2.flip(img, 1)

    # Brightness ±25%
    lo = max(0.6, 1.0 - 0.35 * strength)
    hi = min(1.4, 1.0 + 0.35 * strength)
    img = np.clip(img * np.random.uniform(lo, hi), 0.0, 1.0)

    # Gaussian noise
    if np.random.rand() > (0.7 - 0.2 * strength):
        noise = np.random.normal(0, 0.02 + 0.03 * strength, img.shape).astype(np.float32)
        img = np.clip(img + noise, 0.0, 1.0)

    # Rotation ±10°
    if np.random.rand() > 0.5:
        angle = np.random.uniform(-10, 10)
        cx, cy = img_size // 2, img_size // 2
        M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
        img = cv2.warpAffine(img, M, (img_size, img_size))

    # Zoom
    if np.random.rand() > 0.6:
        scale = np.random.uniform(0.9, 1.1)
        new_size = int(img_size * scale)
        if new_size > img_size:
            img_big = cv2.resize(img, (new_size, new_size))
            diff = (new_size - img_size) // 2
            img = img_big[diff:diff + img_size, diff:diff + img_size]
        else:
            img_small = cv2.resize(img, (new_size, new_size))
            pad = (img_size - new_size) // 2
            canvas = np.zeros((img_size, img_size), dtype=np.float32)
            canvas[pad:pad + new_size, pad:pad + new_size] = img_small
            img = canvas

    return img

class RAFDBGenerator(Sequence):
    def __init__(self, sequences, labels, batch_size=16, seq_len=10, img_size=48, augment=False, **kwargs):
        super().__init__(**kwargs)
        self.sequences  = sequences
        self.labels     = labels
        self.batch_size = batch_size
        self.seq_len    = seq_len
        self.img_size   = img_size
        self.augment    = augment
        self.indices    = np.arange(len(sequences))

    def on_epoch_end(self):
        np.random.shuffle(self.indices)

    def __len__(self):
        return max(1, len(self.sequences) // self.batch_size)

    def __getitem__(self, idx):
        batch_idx    = self.indices[idx * self.batch_size: (idx + 1) * self.batch_size]
        batch_seqs   = [self.sequences[i] for i in batch_idx]
        batch_labels = [self.labels[i]    for i in batch_idx]

        X = np.zeros(
            (len(batch_seqs), self.seq_len, self.img_size, self.img_size, 1),
            dtype=np.float32
        )

        for b, seq_paths in enumerate(batch_seqs):
            # RAF-DB sequences are always pseudo-sequences (repeated image)
            aug_strength = 1.0 

            for t, item in enumerate(seq_paths):
                try:
                    raw = cv2.imread(item, cv2.IMREAD_GRAYSCALE)
                    if raw is None: continue
                    frame = cv2.resize(raw, (self.img_size, self.img_size))
                    frame = frame.astype(np.float32) / 255.0

                    if self.augment:
                        frame = _augment_frame(frame, self.img_size, strength=aug_strength)

                    X[b, t, :, :, 0] = frame
                except Exception:
                    pass

        y = to_categorical(batch_labels, num_classes=len(emotion_labels))
        return X, y

# =====================================================================
# MAIN
# =====================================================================

if __name__ == "__main__":
    print("=" * 62)
    print("🚀 TruthLens — RAF-DB Training Pipeline (Keras)")
    print("=" * 62)

    RAF_TRAIN = "data/rafdb/raf-db-dataset/DATASET/train"
    RAF_TEST  = "data/rafdb/raf-db-dataset/DATASET/test"

    print("\n📂 Loading RAF-DB dataset...")
    train_seqs, train_labels = load_rafdb_data(RAF_TRAIN, is_test=False, seq_len=SEQUENCE_LENGTH)
    val_seqs, val_labels = load_rafdb_data(RAF_TEST, is_test=True, seq_len=SEQUENCE_LENGTH)

    if len(train_seqs) == 0:
        print("\n❌ No training data found! Please check the dataset path.")
        exit(1)

    print(f"   Train: {len(train_seqs):,} sequences")
    print(f"   Val:   {len(val_seqs):,} sequences")

    # Class distribution
    uniq, counts = np.unique(train_labels, return_counts=True)
    print("\n   Per-class distribution (Train):")
    for u, c in zip(uniq, counts):
        print(f"     {emotion_labels[u]:10s}: {c:,}")

    # Class weights
    n_total   = len(train_labels)
    n_classes = len(emotion_labels)
    class_weight_dict = {}
    for cls in range(n_classes):
        n_cls = max(1, sum(1 for l in train_labels if l == cls))
        class_weight_dict[cls] = n_total / (n_classes * n_cls)

    print("\n⚖️  Class weights:")
    for i, w in class_weight_dict.items():
        print(f"     {emotion_labels[i]:10s}: {w:.3f}")

    train_gen = RAFDBGenerator(
        sequences=train_seqs, labels=train_labels,
        batch_size=BATCH_SIZE, seq_len=SEQUENCE_LENGTH,
        img_size=IMG_SIZE, augment=True
    )
    val_gen = RAFDBGenerator(
        sequences=val_seqs, labels=val_labels,
        batch_size=BATCH_SIZE, seq_len=SEQUENCE_LENGTH,
        img_size=IMG_SIZE, augment=False
    )

    print("\n🏗️  Building CNN-BiLSTM + SE Attention + Temporal Attention…")
    model = build_model(
        input_shape=(SEQUENCE_LENGTH, IMG_SIZE, IMG_SIZE, 1),
        num_classes=n_classes
    )
    
    CHECKPOINT_PATH = "model/emotion_model_rafdb.keras"
    if os.path.exists(CHECKPOINT_PATH):
        try:
            model.load_weights(CHECKPOINT_PATH)
            print(f"\n🔄 Resuming from existing checkpoint: {CHECKPOINT_PATH}")
        except Exception as e:
            print(f"\n⚠️ Could not load weights from {CHECKPOINT_PATH}: {e}")

    model.compile(
        optimizer=Adam(learning_rate=0.001),
        loss=CategoricalCrossentropy(label_smoothing=LABEL_SMOOTHING),
        metrics=['accuracy']
    )

    os.makedirs("model", exist_ok=True)

    early_stop = EarlyStopping(
        monitor='val_accuracy',
        patience=15,
        restore_best_weights=True,
        verbose=1
    )
    checkpoint = ModelCheckpoint(
        filepath="model/emotion_model_rafdb.keras",
        monitor='val_accuracy',
        save_best_only=True,
        mode='max',
        verbose=1
    )
    reduce_lr = ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=5,
        min_lr=1e-6,
        verbose=1
    )

    print(f"\n🔥 Training on {len(train_seqs):,} sequences "
          f"({len(train_gen)} steps/epoch, up to {EPOCHS} epochs)…\n")

    history = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS,
        callbacks=[early_stop, checkpoint, reduce_lr],
        class_weight=class_weight_dict,
        verbose=1
    )

    best_val_acc = max(history.history.get('val_accuracy', [0]))
    best_epoch   = history.history['val_accuracy'].index(best_val_acc) + 1

    print("\n" + "=" * 62)
    print("✅ Training Complete!")
    print(f"   Best val_accuracy  : {best_val_acc * 100:.2f}%  (epoch {best_epoch})")
    print(f"   Model (.keras)     : model/emotion_model_rafdb.keras")
    print("=" * 62)
