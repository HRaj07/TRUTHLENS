import os
import cv2
import numpy as np
import time
import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim

from ai_engine.mlx_cnn_lstm_model import MLXTruthLensModel

# Inherit existing constants and generic helper functions from train.py
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

# RAF-DB mapping for test folders (1-7) to canonical string labels
RAF_TEST_MAP = {
    '1': 'surprise', '2': 'fear', '3': 'disgust', '4': 'happy', 
    '5': 'sad', '6': 'angry', '7': 'neutral'
}

def load_rafdb_data(target_dir, is_test=False, seq_len=10):
    sequences, labels = [], []
    if not os.path.exists(target_dir):
        print(f"   ⚠️ Directory not found: {target_dir}")
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
        print(f"   ⚠️ Directory not found: {target_dir}")
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
# MLX DATALOADER & METRICS
# =====================================================================

def batch_iterate(sequences, labels, batch_size, seq_len, img_size, augment=False, shuffle=True):
    indices = np.arange(len(sequences))
    if shuffle:
        np.random.shuffle(indices)
        
    for idx in range(0, len(sequences), batch_size):
        batch_idx = indices[idx: idx + batch_size]
        if len(batch_idx) == 0: break
        
        batch_seqs   = [sequences[i] for i in batch_idx]
        batch_labels = [labels[i]    for i in batch_idx]
        
        X = np.zeros((len(batch_seqs), seq_len, img_size, img_size, 1), dtype=np.float32)
        
        for b, seq_paths in enumerate(batch_seqs):
            # If all paths in sequence are identical, it's a pseudo-sequence (FER/RAF/CK) requiring stronger augment
            is_pseudo_seq = (len(set([str(p) for p in seq_paths])) == 1)
            aug_strength = 1.0 if is_pseudo_seq else 0.5
            
            for t, item in enumerate(seq_paths):
                try:
                    # Item can be string path or array
                    if isinstance(item, str):
                        raw = cv2.imread(item, cv2.IMREAD_GRAYSCALE)
                        if raw is None: continue
                        frame = cv2.resize(raw, (img_size, img_size))
                    else:
                        frame = item
                        if len(frame.shape) == 3 and frame.shape[2] == 3:
                            frame = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
                        elif len(frame.shape) == 3 and frame.shape[2] == 1:
                            frame = frame[:, :, 0]
                        if frame.shape[0] != img_size:
                            frame = cv2.resize(frame, (img_size, img_size))

                    frame = frame.astype(np.float32) / 255.0

                    if augment:
                        frame = _augment_frame(frame, img_size, strength=aug_strength)

                    X[b, t, :, :, 0] = frame
                except Exception:
                    pass
                    
        yield mx.array(X), mx.array(batch_labels, dtype=mx.int32)

def loss_fn(model, X, y, class_weights_tensor):
    logits = model(X)
    
    # --- FOCAL LOSS ENHANCEMENT ---
    # 1. Base Cross Entropy per element with reduced label smoothing (0.05) for starker confidence
    ce_loss = nn.losses.cross_entropy(logits, y, label_smoothing=0.05)
    
    # 2. Focal Weight calculation (gamma=2.0 gives heavy focus to tough, low-probability examples)
    probs = mx.softmax(logits, axis=-1)
    batch_idx = mx.arange(logits.shape[0])
    pt = probs[batch_idx, y]
    focal_weight = (1.0 - pt) ** 2.0
    
    # 3. Apply standard dataset statistical class balance weights
    sample_weights = class_weights_tensor[y]
    
    # 4. Final multi-factor loss calculation
    weighted_loss = mx.mean(focal_weight * ce_loss * sample_weights)
    
    preds = mx.argmax(logits, axis=-1)
    acc = mx.mean((preds == y))
    
    return weighted_loss, acc

def evaluate(model, sequences, labels, batch_size):
    model.eval()
    total_acc = 0.0
    total_loss = 0.0
    n_batches = 0
    
    for X, y in batch_iterate(sequences, labels, batch_size, SEQUENCE_LENGTH, IMG_SIZE, augment=False, shuffle=False):
        logits = model(X)
        loss = mx.mean(nn.losses.cross_entropy(logits, y))
        preds = mx.argmax(logits, axis=-1)
        total_acc += mx.mean((preds == y)).item()
        total_loss += loss.item()
        n_batches += 1
        
    return total_loss / n_batches if n_batches > 0 else 0, total_acc / n_batches if n_batches > 0 else 0

# =====================================================================
# MAIN EXECUTION
# =====================================================================

if __name__ == "__main__":
    print("=" * 62)
    print("🚀 TruthLens — OMNI MASTER TRAINING (MLX Accelerated)")
    print("   Combining RAVDESS + FER-2013 + RAF-DB + CK+")
    print("=" * 62)

    all_seqs = []
    all_labels = []

    # 1. Load RAVDESS and FER-2013 (Using logic inherited from train.py)
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

    # 2. Load RAF-DB
    print("\n📂 Loading RAF-DB...")
    raf_train = "data/rafdb/raf-db-dataset/DATASET/train"
    raf_test  = "data/rafdb/raf-db-dataset/DATASET/test"
    rb_train_seqs, rb_train_labels = load_rafdb_data(raf_train, is_test=False, seq_len=SEQUENCE_LENGTH)
    rb_test_seqs, rb_test_labels   = load_rafdb_data(raf_test, is_test=True, seq_len=SEQUENCE_LENGTH)
    all_seqs.extend(rb_train_seqs + rb_test_seqs)
    all_labels.extend(rb_train_labels + rb_test_labels)
    print(f"   ► Found {len(rb_train_seqs) + len(rb_test_seqs):,} items")

    # 3. Load CK+
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

    # Dynamic Class weights for MLX array 
    n_total   = len(train_labels)
    n_classes = len(emotion_labels)
    cw_list = [0.0] * n_classes
    for cls in range(n_classes):
        n_cls = max(1, sum(1 for l in train_labels if l == cls))
        cw_list[cls] = n_total / (n_classes * n_cls)
    class_weights_tensor = mx.array(cw_list, dtype=mx.float32)

    print("\n🏗️  Building MLX CNN-BiLSTM + SE Attention model…")
    model = MLXTruthLensModel(num_classes=n_classes)
    mx.eval(model.parameters())
    
    CHECKPOINT_PATH = "model/emotion_model_omni_mlx.npz"
    # We can fallback to the most generic best model if omni model doesn't exist yet
    FALLBACK_PATH = "model/emotion_model_best_mlx.npz"
    
    if os.path.exists(CHECKPOINT_PATH):
        model.load_weights(CHECKPOINT_PATH)
        print(f"\n🔄 Resuming Omni Model from existing checkpoint: {CHECKPOINT_PATH}")
    elif os.path.exists(FALLBACK_PATH):
        model.load_weights(FALLBACK_PATH)
        print(f"\n🔄 Bootstrapping Omni Model using previous best checkpoint: {FALLBACK_PATH}")
    else:
        print("\n✅ Native MLX Model Constructed (Starting Fresh without priors)")

    optimizer = optim.Adam(learning_rate=0.001)
    state = [model.state, optimizer.state]

    def step(X, y):
        loss_and_grad_fn = nn.value_and_grad(model, loss_fn)
        (loss, acc), grads = loss_and_grad_fn(model, X, y, class_weights_tensor)
        optimizer.update(model, grads)
        return loss, acc

    os.makedirs("model", exist_ok=True)
    best_val_acc = 0.0

    print(f"\n🔥 Training OMNI Model on {len(train_seqs):,} sequences (up to {EPOCHS} epochs) with MLX\n")

    for epoch in range(1, EPOCHS + 1):
        model.train()
        start_time = time.time()
        
        epoch_loss = 0.0
        epoch_acc = 0.0
        steps = 0
        
        for X, y in batch_iterate(train_seqs, train_labels, BATCH_SIZE, SEQUENCE_LENGTH, IMG_SIZE, augment=True):
            loss, acc = step(X, y)
            mx.eval(model.state, optimizer.state, loss, acc) 
            
            epoch_loss += loss.item()
            epoch_acc += acc.item()
            steps += 1
            
            if steps % 100 == 0:
                print(f"Epoch {epoch} | Step {steps} | Loss: {loss.item():.4f} | Acc: {acc.item():.4f}")
                
        train_loss = epoch_loss / steps if steps > 0 else 0
        train_acc = epoch_acc / steps if steps > 0 else 0
        
        val_loss, val_acc = evaluate(model, val_seqs, val_labels, BATCH_SIZE)
        
        epoch_time = time.time() - start_time
        print(f"==> Epoch {epoch}/{EPOCHS} [{epoch_time:.0f}s] - loss: {train_loss:.4f} - acc: {train_acc:.4f} - val_loss: {val_loss:.4f} - val_acc: {val_acc:.4f}")
        
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            model.save_weights("model/emotion_model_omni_mlx.npz")
            print(f"    🌟 val_accuracy improved to {val_acc:.5f}, saved to model/emotion_model_omni_mlx.npz")
            
    print("\n✅ Omni Training Complete!")
