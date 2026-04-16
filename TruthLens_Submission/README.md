<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/shield-check.svg" width="100" />

  # 👁️ TruthLens AI
  ### The Ultimate Behavioral Analysis & Emotion Recognition Engine
  
  [![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com/)
  [![React](https://img.shields.io/badge/React-18.2+-61DAFB.svg)](https://react.dev/)
  [![MLX](https://img.shields.io/badge/Apple_Silicon-MLX_Accelerated-black.svg?)](https://ml-explore.github.io/mlx/)
  [![License](https://img.shields.io/badge/License-MIT-purple.svg)]()
</div>

<br/>

## 🎯 About The Project

**TruthLens** is an enterprise-grade behavioral analysis platform designed to bring objective metrics to technical interviews, focus groups, and telemedicine. By utilizing a highly optimized, fully custom **Spatial-Temporal CNN-BiLSTM network**, TruthLens analyzes facial micro-expressions in real-time, mapping them to 7 canonical emotions, generating rich behavioral insights, stress levels, and confidence matrices.

This submission folder contains the core machine learning implementation, the dataset configuration, deployment files, and the verified results achieved after extensive multi-dataset training.

---

## 🧠 System Architecture

Our AI engine is built with a proprietary **two-tiered** prediction strategy for flawless latency and maximum accuracy:

### Tier 1: The OMNI Model (CNN-BiLSTM)
A custom-built model constructed from scratch in `Apple MLX` to fully exploit Apple M-Series Silicon. 
- **CNN Backbone:** Extracts deep spatial facial features from 48x48 cropped face vectors.
- **BiLSTM (Bidirectional LSTM):** Understands the *temporal flow* of emotions. It looks at the sequence of the past 10 frames to distinguish between a genuine smile and a fleeting twitch.
- **Squeeze-and-Excitation (SE) Block:** Adds an attention mechanism to weigh the importance of specific facial features.

### Tier 2: Real-time Fallback Engine
When the primary model experiences unconfident bounds, the system seamlessly falls back to a custom-integrated FER wrapper utilizing OpenCV Haar Cascades and temporal exponential moving average (EMA) smoothing to prevent UI flickering.

---

## 📈 Performance & Results

The TruthLens OMNI model was trained synchronously over four of the world's most robust facial datasets: **RAF-DB**, **FER-2013**, **CK+**, and **RAVDESS**.

To force the model to learn difficult, low-frequency emotions like *Disgust* and *Fear*, we implemented **Focal Loss** combined with heavily mathematical class-weights. 

### 🏆 Final Benchmark Metrics
* **Hardware Output:** Apple M3 Silicon via MLX Framework
* **Top-1 Global Accuracy:** `81.54%`
* **Validation Loss (Focal):** `0.421`

| Dataset | Training Accuracy | Validation Accuracy | Note |
|---------|-------------------|---------------------|------|
| **CK+** | 98.2% | **91.5%** | Lab-controlled, high quality |
| **RAF-DB** | 89.1% | **82.3%** | Real-world facial expressions |
| **RAVDESS** | 85.4% | **79.1%** | Video-based temporal expressions |
| **FER-2013** | 74.2% | **68.8%** | Web-scraped diversity |

> 📌 *Detailed graphical visualizations of our confusion matrices and convergence charts can be found in the `/results` directory.*

---

## 📂 Submission Directory Guide

This cleanly packaged submission contains everything needed to evaluate, run, and modify the TruthLens Engine:

```text
TruthLens_Submission/
├── 📁 code/                   # The heart of the AI
│   ├── ai_engine/            # Contains the core MLX & Keras model implementations
│   ├── train_all_mlx.py      # The OMNI-dataset MLX training script
│   ├── model.py              # The prediction blending and routing logic
│   └── run_emotion.py        # Live webcam demonstration script
│
├── 📁 dataset/                # Dataset handling configurations and loaders
│
├── 📁 deployment/             # Instructions & scripts for Vercel/Render hosting
│
└── 📁 results/                # Visualizations, weights, and raw performance metrics
    ├── sample_output_viz.jpg # Live visualization of the model in action
    └── metrics.txt           # Detailed F1-Scores and evaluation breakdown
```

---

## 🚀 How to Run the Demo

If you have an Apple Silicon Mac, you can run the model live against your own webcam in just a few seconds.

1. **Install dependencies:**
   ```bash
   pip install mlx opencv-python-headless numpy tensorflow
   ```

2. **Run the Live Demo Script:**
   ```bash
   python code/run_emotion.py
   ```
   *The system will automatically detect your face, apply temporal smoothing, and print your real-time emotion distribution loop to the console.*

---
<div align="center">
  <i>Built with ❤️ by the TruthLens Team</i>
</div>
