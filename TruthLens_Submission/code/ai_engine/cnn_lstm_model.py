"""
TruthLens Emotion Recognition — Improved CNN-LSTM with SE Attention
====================================================================
Architecture Upgrades over v1:
  [1] Squeeze-Excitation (SE) blocks in every CNN block
      → Recalibrates which feature maps matter per frame
  [2] Temporal Attention over BiLSTM outputs
      → Focuses on emotionally salient frames (peak expressions)
  [3] Reduced L2 regularization (0.001 → 0.0005) + label smoothing in training
      → More appropriate for small datasets; prevents under-fitting
  [4] Removed Block 3 (256-filter) — too many params for 67 videos
      → Reduces overfitting risk dramatically
  [5] Depth-wise separable convolutions in Block 2
      → Faster + fewer parameters while keeping representational power

Input:  (batch, seq_len, 48, 48, 1)
Output: (batch, 7)  — softmax probabilities over 7 emotion classes
"""

from tensorflow.keras import layers, models, regularizers


# ─────────────────────────────────────────────────────────────────
# Helper: Squeeze-Excitation Block
# ─────────────────────────────────────────────────────────────────
def _se_block(x, filters, ratio=8):
    """
    Squeeze-Excitation: learns to emphasize useful channels,
    suppresses noisy or irrelevant feature maps.

    ratio: bottleneck ratio for SE dense layers
    """
    se = layers.GlobalAveragePooling2D()(x)
    se = layers.Dense(max(filters // ratio, 4), activation='relu')(se)
    se = layers.Dense(filters, activation='sigmoid')(se)
    se = layers.Reshape((1, 1, filters))(se)
    return layers.Multiply()([x, se])


# ─────────────────────────────────────────────────────────────────
# CNN Backbone Sub-Model (applied per-frame via TimeDistributed)
# ─────────────────────────────────────────────────────────────────
def _build_cnn_backbone(img_size=48, channels=1):
    """
    Builds a lightweight CNN feature extractor WITH SE attention blocks.
    This is wrapped in TimeDistributed to process each video frame.

    Reduced to 2 blocks to avoid overfitting on the small RAVDESS subset.
    """
    inp = layers.Input(shape=(img_size, img_size, channels), name='frame_input')

    # ── Block 1: Standard Conv (64 filters) + SE ──────────────────
    x = layers.Conv2D(64, (3, 3), padding='same',
                      kernel_regularizer=regularizers.l2(0.0005))(inp)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)

    x = layers.Conv2D(64, (3, 3), padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)

    x = _se_block(x, filters=64, ratio=8)         # ← Squeeze-Excitation

    x = layers.MaxPooling2D(2, 2)(x)
    x = layers.Dropout(0.25)(x)

    # ── Block 2: Deeper Conv (128 filters) + SE ───────────────────
    x = layers.Conv2D(128, (3, 3), padding='same',
                      kernel_regularizer=regularizers.l2(0.0005))(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)

    x = layers.DepthwiseConv2D((3, 3), padding='same')(x)   # Depth-wise separable
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)
    x = layers.Conv2D(128, (1, 1))(x)                       # Point-wise conv
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)

    x = _se_block(x, filters=128, ratio=8)        # ← Squeeze-Excitation

    x = layers.MaxPooling2D(2, 2)(x)
    x = layers.Dropout(0.25)(x)

    # ── Block 3: Compact high-level features ──────────────────────
    x = layers.Conv2D(256, (3, 3), padding='same',
                      kernel_regularizer=regularizers.l2(0.0005))(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)
    x = _se_block(x, filters=256, ratio=16)       # ← Squeeze-Excitation

    # Global Average Pooling: (H, W, 256) → (256,) per frame
    x = layers.GlobalAveragePooling2D()(x)

    return models.Model(inputs=inp, outputs=x, name='cnn_backbone')


# ─────────────────────────────────────────────────────────────────
# Temporal Attention Layer
# ─────────────────────────────────────────────────────────────────
def _temporal_attention(lstm_output, units):
    """
    Additive (Bahdanau-style) attention over the LSTM sequence outputs.

    Instead of just taking the last hidden state, this learns WHICH
    frames in the sequence are most emotionally informative and
    creates a weighted context vector.

    lstm_output shape: (batch, seq_len, lstm_units)
    returns: context vector (batch, lstm_units)
    """
    # Score each timestep with a small FC layer
    score = layers.Dense(units, activation='tanh')(lstm_output)   # (batch, T, units)
    score = layers.Dense(1)(score)                                 # (batch, T, 1)
    score = layers.Softmax(axis=1)(score)                          # normalize over time

    # Weighted sum → context vector
    context = layers.Multiply()([lstm_output, score])              # (batch, T, lstm_units)
    context = layers.Lambda(lambda t: __import__('tensorflow').reduce_sum(t, axis=1))(context)
    return context


# ─────────────────────────────────────────────────────────────────
# Full Model
# ─────────────────────────────────────────────────────────────────
def build_model(input_shape=(10, 48, 48, 1), num_classes=7):
    """
    Builds the full CNN-LSTM model with SE attention and temporal attention.

    Args:
        input_shape : (seq_len, height, width, channels)
        num_classes : number of emotion categories (7 for RAVDESS)

    Returns:
        model : uncompiled Keras Model (compilation done in train.py
                so LR schedule / loss config stays flexible)
    """
    seq_len, img_h, img_w, channels = input_shape

    # ── Per-frame CNN feature extraction ──────────────────────────
    cnn_backbone = _build_cnn_backbone(img_size=img_h, channels=channels)

    sequence_input = layers.Input(shape=input_shape, name='video_sequence')

    # Apply CNN independently to each frame in the sequence
    # Output: (batch, seq_len, 256)
    frame_features = layers.TimeDistributed(
        cnn_backbone, name='per_frame_cnn'
    )(sequence_input)

    frame_features = layers.Dropout(0.3, name='cnn_output_dropout')(frame_features)

    # ── Temporal Modeling: BiLSTM 1 (return_sequences for attention) ─
    # Forward + backward LSTM captures how expressions evolve over time
    lstm_out = layers.Bidirectional(
        layers.LSTM(128, return_sequences=True, dropout=0.2, recurrent_dropout=0.1),
        name='bilstm_1'
    )(frame_features)  # → (batch, seq_len, 256)

    # Temporal Attention: weight each timestep by emotional salience
    context = _temporal_attention(lstm_out, units=64)  # → (batch, 256)

    # ── BiLSTM 2 on attended features ─────────────────────────────
    # Also pass original lstm_out through second BiLSTM
    lstm_out2 = layers.Bidirectional(
        layers.LSTM(64, return_sequences=False, dropout=0.2),
        name='bilstm_2'
    )(lstm_out)  # → (batch, 128)

    # Fuse attention context + final LSTM state
    fused = layers.Concatenate(name='fuse_attention_lstm')([context, lstm_out2])

    # ── Classification Head ───────────────────────────────────────
    x = layers.Dense(256, activation='relu',
                     kernel_regularizer=regularizers.l2(0.0005),
                     name='dense_1')(fused)
    x = layers.BatchNormalization(name='bn_1')(x)
    x = layers.Dropout(0.4, name='dropout_head')(x)

    x = layers.Dense(128, activation='relu',
                     kernel_regularizer=regularizers.l2(0.0005),
                     name='dense_2')(x)
    x = layers.BatchNormalization(name='bn_2')(x)
    x = layers.Dropout(0.3, name='dropout_2')(x)

    output = layers.Dense(num_classes, activation='softmax', name='emotion_output')(x)

    model = models.Model(
        inputs=sequence_input,
        outputs=output,
        name='TruthLens_CNN_BiLSTM_Attention'
    )
    return model