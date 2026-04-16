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
from train import stratified_split, _augment_frame

# =====================================================================
# SETTINGS
# =====================================================================
IMG_SIZE        = 48
SEQUENCE_LENGTH = 10
BATCH_SIZE      = 16
EPOCHS          = 80
VAL_SPLIT       = 0.20
LABEL_SMOOTHING = 0.1

emotion_labels = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

# =====================================================================
# DATA LOADING
# =====================================================================

def load_ckplus_data(target_dir, seq_len=10):
    """
    Loads CK+48 dataset.
    Folders exactly match our canonical emotion names (except for 'contempt', which is ignored).
    Images are pseudo-sequenced (repeated).
    """
    sequences, labels = [], []
    
    if not os.path.exists(target_dir):
        print(f"Directory not found: {target_dir}")
        return sequences, labels

    out_label_idx_map = {name: idx for idx, name in enumerate(emotion_labels)}

    for folder in os.listdir(target_dir):
        if folder not in emotion_labels:
            continue

        folder_path = os.path.join(target_dir, folder)
        if not os.path.isdir(folder_path):
            continue

        label_idx = out_label_idx_map[folder]

        for fname in sorted(os.listdir(folder_path)):
            if not fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            
            img_path = os.path.join(folder_path, fname)
            sequences.append([img_path] * seq_len)
            labels.append(label_idx)

    return sequences, labels


class CKPlusGenerator(Sequence):
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
            # CK+ static image repeated
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
    print("🚀 TruthLens — CK+ Training Pipeline (Keras)")
    print("=" * 62)

    CKPLUS_DATA_DIR = "data/ckplus/CK+48"

    print("\n📂 Loading CK+ dataset...")
    all_seqs, all_labels = load_ckplus_data(CKPLUS_DATA_DIR, seq_len=SEQUENCE_LENGTH)

    if len(all_seqs) == 0:
        print("\n❌ No data found! Please check the dataset path.")
        exit(1)

    print(f"\n🔀 Stratified {int((1-VAL_SPLIT)*100)}/{int(VAL_SPLIT*100)} split per class…")
    train_seqs, train_labels, val_seqs, val_labels = stratified_split(
        all_seqs, all_labels, val_fraction=VAL_SPLIT
    )
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

    train_gen = CKPlusGenerator(
        sequences=train_seqs, labels=train_labels,
        batch_size=BATCH_SIZE, seq_len=SEQUENCE_LENGTH,
        img_size=IMG_SIZE, augment=True
    )
    val_gen = CKPlusGenerator(
        sequences=val_seqs, labels=val_labels,
        batch_size=BATCH_SIZE, seq_len=SEQUENCE_LENGTH,
        img_size=IMG_SIZE, augment=False
    )

    print("\n🏗️  Building CNN-BiLSTM + SE Attention + Temporal Attention…")
    model = build_model(
        input_shape=(SEQUENCE_LENGTH, IMG_SIZE, IMG_SIZE, 1),
        num_classes=n_classes
    )
    
    CHECKPOINT_PATH = "model/emotion_model_ckplus.keras"
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
        filepath="model/emotion_model_ckplus.keras",
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
    print(f"   Model (.keras)     : model/emotion_model_ckplus.keras")
    print("=" * 62)
