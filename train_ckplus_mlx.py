import os
import cv2
import numpy as np
import time
import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim

from ai_engine.mlx_cnn_lstm_model import MLXTruthLensModel

from train import (
    emotion_labels,
    _augment_frame,
    stratified_split,
    SEQUENCE_LENGTH,
    IMG_SIZE,
    BATCH_SIZE,
    EPOCHS,
    VAL_SPLIT,
    LABEL_SMOOTHING
)

def load_ckplus_data(target_dir, seq_len=10):
    """
    Loads CK+48 dataset.
    Excludes any folders not existing in standard emotion_labels (e.g., 'contempt').
    Static frames are repeated seq_len times to form a pseudo-sequence.
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
            # Repeat the same image seq_len times to create a sequence
            sequences.append([img_path] * seq_len)
            labels.append(label_idx)

    return sequences, labels

def batch_iterate(sequences, labels, batch_size, seq_len, img_size, augment=False, shuffle=True):
    """Yields MLX batches."""
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
            is_pseudo_seq = True
            aug_strength = 1.0 if is_pseudo_seq else 0.5
            
            for t, item in enumerate(seq_paths):
                try:
                    raw = cv2.imread(item, cv2.IMREAD_GRAYSCALE)
                    if raw is None: continue
                    frame = cv2.resize(raw, (img_size, img_size))
                    frame = frame.astype(np.float32) / 255.0

                    if augment:
                        frame = _augment_frame(frame, img_size, strength=aug_strength)

                    X[b, t, :, :, 0] = frame
                except Exception:
                    pass
                    
        yield mx.array(X), mx.array(batch_labels, dtype=mx.int32)

def loss_fn(model, X, y, class_weights_tensor):
    logits = model(X)
    loss = nn.losses.cross_entropy(logits, y, label_smoothing=LABEL_SMOOTHING)
    
    sample_weights = class_weights_tensor[y]
    weighted_loss = mx.mean(loss * sample_weights)
    
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


if __name__ == "__main__":
    print("=" * 62)
    print("🚀 TruthLens — CK+ MLX Accelerated Training")
    print("=" * 62)

    CKPLUS_DATA_DIR = "data/ckplus/CK+48"

    print("\n📂 Loading CK+ dataset...")
    all_seqs, all_labels = load_ckplus_data(CKPLUS_DATA_DIR, seq_len=SEQUENCE_LENGTH)

    if len(all_seqs) == 0:
        print("\n❌ No data found! Please check the dataset path.")
        exit(1)

    print(f"\n🔀 Stratified split…")
    train_seqs, train_labels, val_seqs, val_labels = stratified_split(all_seqs, all_labels, val_fraction=VAL_SPLIT)
    print(f"   Train: {len(train_seqs):,} sequences")
    print(f"   Val:   {len(val_seqs):,} sequences")

    # Class weights for MLX array
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
    
    CHECKPOINT_PATH = "model/emotion_model_ckplus_mlx.npz"
    if os.path.exists(CHECKPOINT_PATH):
        model.load_weights(CHECKPOINT_PATH)
        print(f"\n🔄 Resuming from existing checkpoint: {CHECKPOINT_PATH}")
    else:
        print("\n✅ Native MLX Model Constructed (Starting Fresh)")

    optimizer = optim.Adam(learning_rate=0.001)
    state = [model.state, optimizer.state]

    def step(X, y):
        loss_and_grad_fn = nn.value_and_grad(model, loss_fn)
        (loss, acc), grads = loss_and_grad_fn(model, X, y, class_weights_tensor)
        optimizer.update(model, grads)
        return loss, acc

    os.makedirs("model", exist_ok=True)
    best_val_acc = 0.0

    print(f"\n🔥 Training on {len(train_seqs):,} sequences (up to {EPOCHS} epochs) with MLX\n")

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
            
            if steps % 10 == 0:
                print(f"Epoch {epoch} | Step {steps} | Loss: {loss.item():.4f} | Acc: {acc.item():.4f}")
                
        train_loss = epoch_loss / steps if steps > 0 else 0
        train_acc = epoch_acc / steps if steps > 0 else 0
        
        val_loss, val_acc = evaluate(model, val_seqs, val_labels, BATCH_SIZE)
        
        epoch_time = time.time() - start_time
        print(f"==> Epoch {epoch}/{EPOCHS} [{epoch_time:.0f}s] - loss: {train_loss:.4f} - acc: {train_acc:.4f} - val_loss: {val_loss:.4f} - val_acc: {val_acc:.4f}")
        
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            model.save_weights("model/emotion_model_ckplus_mlx.npz")
            print(f"    🌟 val_accuracy improved to {val_acc:.5f}, saved to model/emotion_model_ckplus_mlx.npz")
            
    print("\n✅ Training Complete!")
