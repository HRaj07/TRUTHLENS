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
    SEQUENCE_LENGTH,
    IMG_SIZE,
    BATCH_SIZE,
    EPOCHS,
    LABEL_SMOOTHING
)

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

def load_rafdb_data(target_dir, is_test=False, seq_len=10):
    """
    Loads RAF-DB data.
    If is_test=True, it expects subfolders named 1-7.
    If is_test=False, it expects subfolders named angry, fear, etc.
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
            # Repeat the same image seq_len times to create a sequence for CNN-LSTM
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
            is_pseudo_seq = True # Because RAF-DB contains single static images repeated
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
    print("🚀 TruthLens — RAF-DB MLX Accelerated Training")
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
    
    CHECKPOINT_PATH = "model/emotion_model_best_mlx.npz"
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
        
        epoch_loss, epoch_acc, steps = 0.0, 0.0, 0
        
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
            model.save_weights("model/emotion_model_rafdb_mlx.npz")
            print(f"    🌟 val_accuracy improved to {val_acc:.5f}, saved to model/emotion_model_rafdb_mlx.npz")
            
    print("\n✅ Training Complete!")
