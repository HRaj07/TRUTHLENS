import mlx.core as mx
import mlx.nn as nn

class SEBlock(nn.Module):
    def __init__(self, channels, ratio=8):
        super().__init__()
        self.fc1 = nn.Linear(channels, max(channels // ratio, 4))
        self.fc2 = nn.Linear(max(channels // ratio, 4), channels)
        
    def __call__(self, x):
        b, h, w, c = x.shape
        se = x.mean(axis=(1, 2))
        se = nn.relu(self.fc1(se))
        se = mx.sigmoid(self.fc2(se))
        se = se.reshape(b, 1, 1, c)
        return x * se

class CNNBackbone(nn.Module):
    def __init__(self, img_size=48, channels=1):
        super().__init__()
        self.conv1_1 = nn.Conv2d(channels, 64, kernel_size=3, padding=1)
        self.bn1_1 = nn.BatchNorm(64)
        self.conv1_2 = nn.Conv2d(64, 64, kernel_size=3, padding=1)
        self.bn1_2 = nn.BatchNorm(64)
        self.se1 = SEBlock(64, 8)
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)
        self.drop1 = nn.Dropout(0.25)
        
        self.conv2_1 = nn.Conv2d(64, 128, kernel_size=3, padding=1)
        self.bn2_1 = nn.BatchNorm(128)
        self.conv2_dw = nn.Conv2d(128, 128, kernel_size=3, padding=1, groups=128)
        self.bn2_dw = nn.BatchNorm(128)
        self.conv2_pw = nn.Conv2d(128, 128, kernel_size=1)
        self.bn2_pw = nn.BatchNorm(128)
        self.se2 = SEBlock(128, 8)
        self.pool2 = nn.MaxPool2d(kernel_size=2, stride=2)
        self.drop2 = nn.Dropout(0.25)
        
        self.conv3_1 = nn.Conv2d(128, 256, kernel_size=3, padding=1)
        self.bn3_1 = nn.BatchNorm(256)
        self.se3 = SEBlock(256, 16)
        
    def __call__(self, x):
        # x is [B, H, W, C]
        x = self.conv1_1(x)
        x = self.bn1_1(x)
        x = nn.relu(x)
        x = self.conv1_2(x)
        x = self.bn1_2(x)
        x = nn.relu(x)
        x = self.se1(x)
        x = self.pool1(x)
        x = self.drop1(x)
        
        x = self.conv2_1(x)
        x = self.bn2_1(x)
        x = nn.relu(x)
        x = self.conv2_dw(x)
        x = self.bn2_dw(x)
        x = nn.relu(x)
        x = self.conv2_pw(x)
        x = self.bn2_pw(x)
        x = nn.relu(x)
        x = self.se2(x)
        x = self.pool2(x)
        x = self.drop2(x)
        
        x = self.conv3_1(x)
        x = self.bn3_1(x)
        x = nn.relu(x)
        x = self.se3(x)
        x = x.mean(axis=(1, 2)) # Global Average Pooling
        return x

class TemporalAttention(nn.Module):
    def __init__(self, input_dim, units):
        super().__init__()
        self.fc = nn.Linear(input_dim, units)
        self.fc_score = nn.Linear(units, 1)

    def __call__(self, lstm_output):
        # lstm_output: [B, T, D]
        score = mx.tanh(self.fc(lstm_output))
        score = self.fc_score(score)
        score = mx.softmax(score, axis=1)
        context = mx.sum(lstm_output * score, axis=1)
        return context

class BiLSTM(nn.Module):
    def __init__(self, input_size, hidden_size):
        super().__init__()
        self.fwd_lstm = nn.LSTM(input_size, hidden_size)
        self.bwd_lstm = nn.LSTM(input_size, hidden_size)
        
    def __call__(self, x):
        fwd_out, _ = self.fwd_lstm(x)
        bwd_x = x[:, ::-1, :]
        bwd_out, _ = self.bwd_lstm(bwd_x)
        bwd_out = bwd_out[:, ::-1, :]
        return mx.concatenate([fwd_out, bwd_out], axis=-1)

class MLXTruthLensModel(nn.Module):
    def __init__(self, num_classes=7):
        super().__init__()
        self.cnn = CNNBackbone()
        self.cnn_drop = nn.Dropout(0.3)
        
        # In Keras BiLSTM(128) outputs 256 (128 per dir)
        self.bilstm1 = BiLSTM(input_size=256, hidden_size=128)
        self.bilstm1_drop = nn.Dropout(0.2)
        
        self.attention = TemporalAttention(input_dim=256, units=64)
        
        self.bilstm2 = BiLSTM(input_size=256, hidden_size=64)
        self.bilstm2_drop = nn.Dropout(0.2)
        
        self.dense1 = nn.Linear(128 + 256, 256)
        self.bn_d1 = nn.BatchNorm(256)
        self.drop_d1 = nn.Dropout(0.4)
        
        self.dense2 = nn.Linear(256, 128)
        self.bn_d2 = nn.BatchNorm(128)
        self.drop_d2 = nn.Dropout(0.3)
        
        self.out = nn.Linear(128, num_classes)
        
    def __call__(self, x):
        # x: [B, T, H, W, C]
        b, t, h, w, c = x.shape
        x = x.reshape(b * t, h, w, c)
        
        x = self.cnn(x) # [B*T, 256]
        x = self.cnn_drop(x)
        
        x = x.reshape(b, t, -1) # [B, T, 256]
        
        lstm1_out = self.bilstm1(x) # [B, T, 256]
        lstm1_out = self.bilstm1_drop(lstm1_out)
        
        context = self.attention(lstm1_out) # [B, 256]
        
        lstm2_out = self.bilstm2(lstm1_out) # [B, T, 128]
        lstm2_out = self.bilstm2_drop(lstm2_out)
        # We only want the final state of BiLSTM2
        lstm2_last = lstm2_out[:, -1, :] # [B, 128]
        
        fused = mx.concatenate([context, lstm2_last], axis=-1) # [B, 384]
        
        d = self.dense1(fused)
        d = self.bn_d1(d)
        d = nn.relu(d)
        d = self.drop_d1(d)
        
        d = self.dense2(d)
        d = self.bn_d2(d)
        d = nn.relu(d)
        d = self.drop_d2(d)
        
        logits = self.out(d)
        # Note: MLX nn.losses.cross_entropy expects logits, no softmax here manually for training.
        # But for inference, we'd softmax. Let's return logits.
        return logits
