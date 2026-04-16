import os
import cv2
import numpy as np
import time
import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim

from ai_engine.mlx_cnn_lstm_model import MLXTruthLensModel

# We can reuse the helper functions from the original train.py without copying them!
from train import (
    load_combined_data,
    stratified_split,
    emotion_labels,
    _augment_frame,
    SEQUENCE_LENGTH,
    IMG_SIZE,
    OVERLAP,
    BATCH_SIZE,
    EPOCHS,
    VAL_SPLIT,
    LABEL_SMOOTHING
)

def batch_iterate(sequences, labels, batch_size, seq_len, img_size, augment=False, shuffle=True):
    """Yields MLX batches using the original data processing logic."""
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
            is_pseudo_seq = (len(set([str(p) for p in seq_paths])) == 1)
            aug_strength = 1.0 if is_pseudo_seq else 0.5
            
            for t, item in enumerate(seq_paths):
                try:
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
                        else:
                            frame = frame
                        
                        if frame.shape[0] != img_size:
                            frame = cv2.resize(frame, (img_size, img_size))

                    frame = frame.astype(np.float32) / 255.0

                    if augment:
                        frame = _augment_frame(frame, img_size, strength=aug_strength)

                    X[b, t, :, :, 0] = frame
                except Exception:
                    pass
                    
        # yield MLX arrays. Labels as sparse integers for MLX cross_entropy.
        yield mx.array(X), mx.array(batch_labels, dtype=mx.int32)

def loss_fn(model, X, y, class_weights_tensor):
    logits = model(X)
    # MLX expects sparse integer array for y if not doing one-hot
    loss = nn.losses.cross_entropy(logits, y, label_smoothing=LABEL_SMOOTHING)
    
    # Weight by class
    sample_weights = class_weights_tensor[y]
    weighted_loss = mx.mean(loss * sample_weights)
    
    # Accurate count for metrics
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
    print("🚀 TruthLens — MLX Accelerated Training on Apple Silicon")
    print("=" * 62)

    DATASET_PATH = "data/video_datasets/"
    train_root   = os.path.join(DATASET_PATH, 'train')
    val_root     = os.path.join(DATASET_PATH, 'val')
    fer_train    = "data/fer2013/fer2013/train"
    fer_test     = "data/fer2013/fer2013/test"

    print("\n📂 Loading datasets from local folders…")
    all_seqs, all_labels = load_combined_data(
        local_folders=[train_root, val_root, fer_train, fer_test],
        seq_len=SEQUENCE_LENGTH,
        overlap=OVERLAP
    )

    if len(all_seqs) == 0:
        print("\n❌ No data found!")
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

    print("\n   Class weights mapped")

    print("\n🏗️  Building MLX CNN-BiLSTM + SE Attention model…")
    model = MLXTruthLensModel(num_classes=n_classes)
    
    # Initialize parameters
    mx.eval(model.parameters())
    
    # Check for existing checkpoint to resume training
    CHECKPOINT_PATH = "model/emotion_model_best_mlx.npz"
    if os.path.exists(CHECKPOINT_PATH):
        model.load_weights(CHECKPOINT_PATH)
        print(f"\n🔄 Resuming from existing checkpoint: {CHECKPOINT_PATH}")
    else:
        print("\n✅ Native MLX Model Constructed & Mapped to Apple Unified Memory (Starting Fresh)")

    optimizer = optim.Adam(learning_rate=0.001)
    state = [model.state, optimizer.state]

    def step(X, y):
        loss_and_grad_fn = nn.value_and_grad(model, loss_fn)
        (loss, acc), grads = loss_and_grad_fn(model, X, y, class_weights_tensor)
        optimizer.update(model, grads)
        return loss, acc

    os.makedirs("model", exist_ok=True)
    best_val_acc = 0.0

    print(f"\n🔥 Training on {len(train_seqs):,} sequences (up to {EPOCHS} epochs) with Native MLX\n")

    for epoch in range(1, EPOCHS + 1):
        model.train()
        start_time = time.time()
        
        epoch_loss = 0.0
        epoch_acc = 0.0
        steps = 0
        
        # Training
        for X, y in batch_iterate(train_seqs, train_labels, BATCH_SIZE, SEQUENCE_LENGTH, IMG_SIZE, augment=True):
            loss, acc = step(X, y)
            mx.eval(model.state, optimizer.state, loss, acc) # Unpack and dynamically eval state
            
            epoch_loss += loss.item()
            epoch_acc += acc.item()
            steps += 1
            
            if steps % 50 == 0:
                print(f"Epoch {epoch} | Step {steps} | Loss: {loss.item():.4f} | Acc: {acc.item():.4f}")
                
        train_loss = epoch_loss / steps
        train_acc = epoch_acc / steps
        
        # Validation
        val_loss, val_acc = evaluate(model, val_seqs, val_labels, BATCH_SIZE)
        
        epoch_time = time.time() - start_time
        print(f"==> Epoch {epoch}/{EPOCHS} [{epoch_time:.0f}s] - loss: {train_loss:.4f} - acc: {train_acc:.4f} - val_loss: {val_loss:.4f} - val_acc: {val_acc:.4f}")
        
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            model.save_weights("model/emotion_model_best_mlx.npz")
            print(f"    🌟 val_accuracy improved to {val_acc:.5f}, saved to model/emotion_model_best_mlx.npz")
            
    print("\n✅ Training Complete!")
