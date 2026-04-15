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
VAL_SPLIT       = 0.20
OVERLAP         = 5
LABEL_SMOOTHING = 0.1

emotion_labels = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

# =====================================================================
# DATA LOADING - Local files only (RAVDESS + Local FER2013)
# =====================================================================

def load_combined_data(local_folders, seq_len=10, overlap=5):
    """
    Load data exclusively from disk. 
    Handles both multi-frame videos (RAVDESS) and single-image frames 
    (FER2013) securely grouped by folder.
    """
    sequences, labels = [], []

    print(f"📂 Scanning local folders for datasets...")
    for root in local_folders:
        if not os.path.exists(root):
            continue
            
        for label_idx, emotion in enumerate(emotion_labels):
            emo_dir = os.path.join(root, emotion)
            if not os.path.isdir(emo_dir): continue

            # Group frames by video prefix
            video_map = {}
            for fname in sorted(os.listdir(emo_dir)):
                if not fname.lower().endswith(('.jpg', '.jpeg', '.png')): continue
                
                # If it's a RAVDESS frame, it typically has "_frame_"
                # If it's FER2013, it might just be an image name like "Training_123.jpg"
                if "_frame_" in fname:
                    prefix = fname.rsplit('_frame_', 1)[0]
                else:
                    prefix = fname # FER images are standalone, use full filename as prefix

                video_map.setdefault(prefix, []).append(os.path.join(emo_dir, fname))

            # Build sliding windows or repeat static frames
            step = seq_len - overlap
            for prefix, frame_paths in video_map.items():
                frame_paths = sorted(frame_paths)
                if len(frame_paths) >= seq_len:
                    # Multi-frame sequence
                    for i in range(0, len(frame_paths) - seq_len + 1, step):
                        sequences.append(frame_paths[i: i + seq_len])
                        labels.append(label_idx)
                else:
                    # Single static image (FER2013) - repeat over time dimension
                    sequences.append([frame_paths[0]] * seq_len)
                    labels.append(label_idx)

    return sequences, labels


# =====================================================================
# AUGMENTATION
# =====================================================================

def _augment_frame(img, img_size, strength=1.0):
    """
    Per-frame augmentation.  `strength` (0-1) lets FER2013 pseudo-sequences
    use stronger augmentation (each repeated frame needs to look distinct)
    while RAVDESS sequences use lighter augmentation.
    """
    # Horizontal flip
    if np.random.rand() > 0.5:
        img = cv2.flip(img, 1)

    # Brightness ±25% (stronger for single-frame sequences)
    lo = max(0.6, 1.0 - 0.35 * strength)
    hi = min(1.4, 1.0 + 0.35 * strength)
    img = np.clip(img * np.random.uniform(lo, hi), 0.0, 1.0)

    # Gaussian noise
    if np.random.rand() > (0.7 - 0.2 * strength):
        noise = np.random.normal(0, 0.02 + 0.03 * strength, img.shape).astype(np.float32)
        img = np.clip(img + noise, 0.0, 1.0)

    # Small rotation ±10°
    if np.random.rand() > 0.5:
        angle = np.random.uniform(-10, 10)
        cx, cy = img_size // 2, img_size // 2
        M = cv2.getRotationMatrix2D((cx, cy), angle, 1.0)
        img = cv2.warpAffine(img, M, (img_size, img_size))

    # Zoom: random crop then resize back (±10%)
    if np.random.rand() > 0.6:
        scale = np.random.uniform(0.9, 1.1)
        new_size = int(img_size * scale)
        if new_size > img_size:
            # Zoom in: crop centre
            img_big = cv2.resize(img, (new_size, new_size))
            diff = (new_size - img_size) // 2
            img = img_big[diff:diff + img_size, diff:diff + img_size]
        else:
            # Zoom out: pad with zeros
            img_small = cv2.resize(img, (new_size, new_size))
            pad = (img_size - new_size) // 2
            canvas = np.zeros((img_size, img_size), dtype=np.float32)
            canvas[pad:pad + new_size, pad:pad + new_size] = img_small
            img = canvas

    return img


# =====================================================================
# GENERATOR
# =====================================================================

class VideoFrameGenerator(Sequence):
    """
    Keras Sequence data generator for video frame sequences.

    Handles two data types transparently:
      - RAVDESS sequences  : different frame paths → light augmentation
      - FER2013 pseudo-seq : all paths identical  → strong augmentation
                             (each timestep gets a differently augmented view)

    Fixes vs original:
      [1] super().__init__(**kwargs) called → silences Keras warning
      [2] Shuffle on every epoch (on_epoch_end)
      [3] Detects repeated paths (FER2013) → strong per-timestep augmentation
      [4] Robust JPEG loading → corrupt frames left as zeros (no crash)
      [5] All arrays initialised to zeros (not np.empty garbage values)
    """

    def __init__(self, sequences, labels, batch_size=16,
                 seq_len=10, img_size=48, augment=False, **kwargs):
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
            is_pseudo_seq = (len(set([str(p) for p in seq_paths])) == 1)
            aug_strength = 1.0 if is_pseudo_seq else 0.5

            for t, item in enumerate(seq_paths):
                try:
                    # 'item' could be a string path or a numpy array (from TFDS)
                    if isinstance(item, str):
                        raw = cv2.imread(item, cv2.IMREAD_GRAYSCALE)
                        if raw is None: continue
                        frame = cv2.resize(raw, (self.img_size, self.img_size))
                    else:
                        # item is already a numpy array (from TFDS)
                        # Ensure it's grayscale and 48x48
                        if len(item.shape) == 3 and item.shape[2] == 3:
                            frame = cv2.cvtColor(item, cv2.COLOR_RGB2GRAY)
                        elif len(item.shape) == 3 and item.shape[2] == 1:
                            frame = item[:, :, 0]
                        else:
                            frame = item
                        
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
# STRATIFIED SPLIT (pure numpy — no sklearn dependency)
# =====================================================================

def stratified_split(sequences, labels, val_fraction=0.2, seed=42):
    """
    Splits data per class so val set contains at least 1 sample per class.
    Returns (train_seqs, train_labels, val_seqs, val_labels).
    """
    np.random.seed(seed)
    label_arr = np.array(labels)
    train_idx, val_idx = [], []

    for cls in np.unique(label_arr):
        cls_idx = np.where(label_arr == cls)[0].copy()
        np.random.shuffle(cls_idx)
        n_val = max(1, int(len(cls_idx) * val_fraction))
        val_idx.extend(cls_idx[:n_val].tolist())
        train_idx.extend(cls_idx[n_val:].tolist())

    return (
        [sequences[i] for i in train_idx],
        [labels[i]    for i in train_idx],
        [sequences[i] for i in val_idx],
        [labels[i]    for i in val_idx],
    )


# =====================================================================
# MAIN
# =====================================================================

if __name__ == "__main__":
    print("=" * 62)
    print("🚀 TruthLens — Combined RAVDESS + FER2013 Training Pipeline")
    print("=" * 62)

    DATASET_PATH = "data/video_datasets/"
    train_root   = os.path.join(DATASET_PATH, 'train')
    val_root     = os.path.join(DATASET_PATH, 'val')

    # Add the local FER2013 directories you already downloaded
    fer_train = "data/fer2013/fer2013/train"
    fer_test  = "data/fer2013/fer2013/test"

    # ── 1. Load COMBINED data (Local RAVDESS + Local FER2013) ────
    print("\n📂 Loading datasets from local folders…")
    all_seqs, all_labels = load_combined_data(
        local_folders=[train_root, val_root, fer_train, fer_test],
        seq_len=SEQUENCE_LENGTH,
        overlap=OVERLAP
    )

    print(f"\n   ✅ Total sequences ready for training: {len(all_seqs):,}")

    if len(all_seqs) == 0:
        print("\n❌ No data found! Please check your data/ folder or connection.")
        exit(1)

    # Class distribution
    uniq, counts = np.unique(all_labels, return_counts=True)
    print("\n   Per-class distribution:")
    for u, c in zip(uniq, counts):
        print(f"     {emotion_labels[u]:10s}: {c:,}")

    # ── 2. Stratified split ───────────────────────────────────────
    print(f"\n🔀 Stratified {int((1-VAL_SPLIT)*100)}/{int(VAL_SPLIT*100)} split per class…")
    train_seqs, train_labels, val_seqs, val_labels = stratified_split(
        all_seqs, all_labels, val_fraction=VAL_SPLIT
    )
    print(f"   Train: {len(train_seqs):,} sequences")
    print(f"   Val:   {len(val_seqs):,} sequences")

    # Verify all 7 classes in val
    val_classes = set(val_labels)
    missing = [emotion_labels[i] for i in range(7) if i not in val_classes]
    if missing:
        print(f"   ⚠️  Missing val classes: {missing}")
    else:
        print(f"   ✅ All 7 emotion classes represented in validation set")

    # ── 3. Class weights ──────────────────────────────────────────
    n_total   = len(train_labels)
    n_classes = len(emotion_labels)
    class_weight_dict = {}
    for cls in range(n_classes):
        n_cls = max(1, sum(1 for l in train_labels if l == cls))
        class_weight_dict[cls] = n_total / (n_classes * n_cls)

    print("\n⚖️  Class weights:")
    for i, w in class_weight_dict.items():
        print(f"     {emotion_labels[i]:10s}: {w:.3f}")

    # ── 4. Generators ─────────────────────────────────────────────
    train_gen = VideoFrameGenerator(
        sequences=train_seqs, labels=train_labels,
        batch_size=BATCH_SIZE, seq_len=SEQUENCE_LENGTH,
        img_size=IMG_SIZE, augment=True
    )
    val_gen = VideoFrameGenerator(
        sequences=val_seqs, labels=val_labels,
        batch_size=BATCH_SIZE, seq_len=SEQUENCE_LENGTH,
        img_size=IMG_SIZE, augment=False
    )

    # ── 5. Model ──────────────────────────────────────────────────
    print("\n🏗️  Building CNN-BiLSTM + SE Attention + Temporal Attention…")
    model = build_model(
        input_shape=(SEQUENCE_LENGTH, IMG_SIZE, IMG_SIZE, 1),
        num_classes=n_classes
    )
    
    # Check for existing checkpoint to resume training
    CHECKPOINT_PATH = "model/emotion_model_best.keras"
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
    model.summary()
    print(f"\n   Total parameters: {model.count_params():,}")

    # ── 6. Callbacks ──────────────────────────────────────────────
    os.makedirs("model", exist_ok=True)

    early_stop = EarlyStopping(
        monitor='val_accuracy',
        patience=15,                       # was 5 → quit far too early
        restore_best_weights=True,
        verbose=1
    )
    checkpoint = ModelCheckpoint(
        filepath="model/emotion_model_best.keras",
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

    # ── 7. Train ──────────────────────────────────────────────────
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

    # ── 8. Summary ────────────────────────────────────────────────
    best_val_acc = max(history.history.get('val_accuracy', [0]))
    best_epoch   = history.history['val_accuracy'].index(best_val_acc) + 1

    print("\n" + "=" * 62)
    print("✅ Training Complete!")
    print(f"   Best val_accuracy  : {best_val_acc * 100:.2f}%  (epoch {best_epoch})")
    print(f"   Model (.keras)     : model/emotion_model_best.keras")
    print("=" * 62)