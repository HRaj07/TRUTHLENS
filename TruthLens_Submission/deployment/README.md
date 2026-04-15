# TruthLens Deployment Instructions

This folder contains the necessary files to deploy the TruthLens AI model as a web application.

## Files
- `app.py`: The FastAPI-based backend application.
- `emotion_model_best.keras`: Pre-trained CNN-LSTM model weights.

## Prerequisites
- Python 3.8+
- Required libraries (see `code/requirements.txt`)

## Setup & Running
1. **Install dependencies**:
   ```bash
   pip install -r ../code/requirements.txt
   ```
2. **Run the application**:
   ```bash
   python app.py
   ```
3. **Access the API**:
   The server will start on `http://localhost:8000` (by default).

## AI Engine
The application uses the `ai_engine/` logic (located in the `code/` folder) to process incoming video frames and return real-time emotion analysis.
