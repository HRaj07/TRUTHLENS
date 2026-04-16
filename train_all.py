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
from train import (
    emotion_labels,
    _augment_frame,
    stratified_split,
    load_combined_data,
    SEQUENCE_LENGTH,
    IMG_SIZE,
    BATCH_SIZE,
    EPOCHS,
    VAL_SPLIT,
    LABEL_SMOOTHING,
    OVERLAP
)

# =====================================================================
# DATASET HELPERS (RAF-DB & CK+)
# =====================================================================

RAF_TEST_MAP = {
    '1': 'surprise', '2': 'fear', '3': 'disgust', '4': 'happy', 
    '5': 'sad', '6': 'angry', '7': 'neutral'
}

def load_rafdb_data(target_dir, is_test=False, seq_len=10):
    sequences, labels = [], []
    if not os.path.exists(target_dir):
        return sequences, labels
    out_label_idx_map = {name: idx for idx, name in enumerate(emotion_labels)}
    for folder in os.listdir(target_dir):
        folder_path = os.path.join(target_dir, folder)
        if not os.path.isdir(folder_path): continue
        if is_test:
            if folder not in RAF_TEST_MAP: continue
            emotion_name = RAF_TEST_MAP[folder]
        else:
            emotion_name = folder
            if emotion_name not in emotion_labels: continue
        label_idx = out_label_idx_map[emotion_name]
        for fname in sorted(os.listdir(folder_path)):
            if not fname.lower().endswith(('.jpg', '.jpeg', '.png')): continue
            img_path = os.path.join(folder_path, fname)
            sequences.append([img_path] * seq_len)
            labels.append(label_idx)
    return sequences, labels

def load_ckplus_data(target_dir, seq_len=10):
    sequences, labels = [], []
    if not os.path.exists(target_dir):
        return sequences, labels
    out_label_idx_map = {name: idx for idx, name in enumerate(emotion_labels)}
    for folder in os.listdir(target_dir):
        if folder not in emotion_labels: continue  # implicitly ignores 'contempt'
        folder_path = os.path.join(target_dir, folder)
        if not os.path.isdir(folder_path): continue
        label_idx = out_label_idx_map[folder]
        for fname in sorted(os.listdir(folder_path)):
            if not fname.lower().endswith(('.jpg', '.jpeg', '.png')): continue
            img_path = os.path.join(folder_path, fname)
            sequences.append([img_path] * seq_len)
            labels.append(label_idx)
    return sequences, labels

# =====================================================================
# KERAS GENERATOR
# =====================================================================

class OmniGenerator(Sequence):
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

        X = np.zeros((len(batch_seqs), self.seq_len, self.img_size, self.img_size, 1), dtype=np.float32)

        for b, seq_paths in enumerate(batch_seqs):
            is_pseudo_seq = (len(set([str(p) for p in seq_paths])) == 1)
            aug_strength = 1.0 if is_pseudo_seq else 0.5

            for t, item in enumerate(seq_paths):
                try:
                    if isinstance(item, str):
                        raw = cv2.imread(item, cv2.IMREAD_GRAYSCALE)
                        if raw is None: continue
                        frame = cv2.resize(raw, (self.img_size, self.img_size))
                    else:
                        frame = item
                        if len(frame.shape) == 3 and frame.shape[2] == 3:
                            frame = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
                        elif len(frame.shape) == 3 and frame.shape[2] == 1:
                            frame = frame[:, :, 0]
                        if frame.shape[0] != self.img_size:
                            frame = cv2.resize(frame, (self.img_size, self.img_size))

                    frame = frame.astype(np.float32) / 255.0

                    if self.augment:
                        frame = _augment_frame(frame, self.img_size, strength=aug_strength)

                    X[b, t, :, :, 0] = frame
                except Exception:
                    pass

        y = to_categorical(batch_labels, num_classes=len(emotion_labels))
        return X, y

# =====================================================================
# MAIN EXECUTION
# =====================================================================

if __name__ == "__main__":
    print("=" * 62)
    print("🚀 TruthLens — OMNI MASTER TRAINING (TensorFlow/Keras)")
    print("   Combining RAVDESS + FER-2013 + RAF-DB + CK+")
    print("=" * 62)

    all_seqs = []
    all_labels = []

    print("\n📂 Loading RAVDESS & FER-2013...")
    train_root = "data/video_datasets/train"
    val_root   = "data/video_datasets/val"
    fer_train  = "data/fer2013/fer2013/train"
    fer_test   = "data/fer2013/fer2013/test"
    rf_seqs, rf_labels = load_combined_data(
        local_folders=[train_root, val_root, fer_train, fer_test],
        seq_len=SEQUENCE_LENGTH, overlap=OVERLAP
    )
    all_seqs.extend(rf_seqs)
    all_labels.extend(rf_labels)
    print(f"   ► Found {len(rf_seqs):,} items")

    print("\n📂 Loading RAF-DB...")
    raf_train = "data/rafdb/raf-db-dataset/DATASET/train"
    raf_test  = "data/rafdb/raf-db-dataset/DATASET/test"
    rb_train_seqs, rb_train_labels = load_rafdb_data(raf_train, is_test=False, seq_len=SEQUENCE_LENGTH)
    rb_test_seqs, rb_test_labels   = load_rafdb_data(raf_test, is_test=True, seq_len=SEQUENCE_LENGTH)
    all_seqs.extend(rb_train_seqs + rb_test_seqs)
    all_labels.extend(rb_train_labels + rb_test_labels)
    print(f"   ► Found {len(rb_train_seqs) + len(rb_test_seqs):,} items")

    print("\n📂 Loading CK+...")
    ckplus_dir = "data/ckplus/CK+48"
    ck_seqs, ck_labels = load_ckplus_data(ckplus_dir, seq_len=SEQUENCE_LENGTH)
    all_seqs.extend(ck_seqs)
    all_labels.extend(ck_labels)
    print(f"   ► Found {len(ck_seqs):,} items")

    if len(all_seqs) == 0:
        print("\n❌ CRITICAL: No data found at all across any dataset!")
        exit(1)

    print(f"\n🌍 GRAND TOTAL COMPILED DATASET: {len(all_seqs):,} sequences")

    print(f"\n🔀 Unified Stratified split (Train: {int((1-VAL_SPLIT)*100)}%, Val: {int(VAL_SPLIT*100)}%)…")
    train_seqs, train_labels, val_seqs, val_labels = stratified_split(all_seqs, all_labels, val_fraction=VAL_SPLIT)
    print(f"   Train Set: {len(train_seqs):,} sequences")
    print(f"   Val Set:   {len(val_seqs):,} sequences")

    n_total   = len(train_labels)
    n_classes = len(emotion_labels)
    class_weight_dict = {}
    for cls in range(n_classes):
        n_cls = max(1, sum(1 for l in train_labels if l == cls))
        class_weight_dict[cls] = n_total / (n_classes * n_cls)

    train_gen = OmniGenerator(
        sequences=train_seqs, labels=train_labels,
        batch_size=BATCH_SIZE, seq_len=SEQUENCE_LENGTH,
        img_size=IMG_SIZE, augment=True
    )
    val_gen = OmniGenerator(
        sequences=val_seqs, labels=val_labels,
        batch_size=BATCH_SIZE, seq_len=SEQUENCE_LENGTH,
        img_size=IMG_SIZE, augment=False
    )

    print("\n🏗️  Building CNN-BiLSTM + SE Attention model…")
    model = build_model(
        input_shape=(SEQUENCE_LENGTH, IMG_SIZE, IMG_SIZE, 1),
        num_classes=n_classes
    )
    
    CHECKPOINT_PATH = "model/emotion_model_omni.keras"
    FALLBACK_PATH = "model/emotion_model_best.keras"

    if os.path.exists(CHECKPOINT_PATH):
        try:
            model.load_weights(CHECKPOINT_PATH)
            print(f"\n🔄 Resuming Omni Model from existing checkpoint: {CHECKPOINT_PATH}")
        except Exception as e:
            print(f"\n⚠️ Could not load weights from {CHECKPOINT_PATH}: {e}")
    elif os.path.exists(FALLBACK_PATH):
        try:
            model.load_weights(FALLBACK_PATH)
            print(f"\n🔄 Bootstrapping Omni Model using previous best checkpoint: {FALLBACK_PATH}")
        except Exception as e:
            print(f"\n⚠️ Could not load fallback weights from {FALLBACK_PATH}: {e}")

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
        filepath="model/emotion_model_omni.keras",
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

    print(f"\n🔥 Training OMNI Model on {len(train_seqs):,} sequences "
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
    print("✅ Omni Training Complete!")
    print(f"   Best val_accuracy  : {best_val_acc * 100:.2f}%  (epoch {best_epoch})")
    print(f"   Model (.keras)     : model/emotion_model_omni.keras")
    print("=" * 62)
