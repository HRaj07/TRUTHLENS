# 🔍 TruthLens: Next-Gen AI-Driven Behavioral & Technical Interview Intelligence

**TruthLens** is a cutting-edge, high-performance interview platform designed for the modern recruitment landscape. It leverages Peer-to-Peer (P2P) WebRTC communication and Deep Learning-based behavioral analytics to provide interviewers with real-time, objective data on candidate engagement, sentiment, and technical resonance.

---

## 🚀 The Vision
In high-stakes interviews (Top Tier/Big Tech), technical skills are only half the story. The candidate's **emotional intelligence (EQ)**, **communication stability**, and **stress management** often determine the final hire. TruthLens bridges the gap between subjective observation and objective data science.

## 🏗️ Technical Architecture

### 1. Real-Time Communication Layer (WebRTC & WebSockets)
*   **P2P Streaming:** Built on high-fidelity WebRTC protocols for sub-millisecond latency.
*   **Signaling Server:** A robust FastAPI-based signaling backend managing session handshakes, identity verification, and state synchronization.
*   **Bi-Directional Channels:** Dedicated WebSocket channels for real-time AI inference feedback and collaborative chat.

### 2. The AI Intelligence Engine (Deep Learning)
Our proprietary AI pipeline processes video frames in parallel to the interview stream:
*   **CNN-LSTM Fusion:** A Hybrid Convolutional Neural Network and Long Short-Term Memory architecture that analyzes temporal facial dynamics.
*   **Emotion Mapping:** Real-time tracking of 7 core emotions (Neutral, Happy, Sad, Surprise, Fear, Anger, Disgust).
*   **Truthfulness & Stress Index:** Advanced scoring algorithms that detect micro-expressions associated with cognitive load and communication confidence.

### 3. Analytics & Reporting Service
*   **Automated Insights:** Post-interview, the system generates a "Behavioral Fingerprint" for the candidate.
*   **Dynamic PDF Generation:** High-fidelity reporting using `jspdf` and custom Python PDF services, providing clear charts on emotion distribution and technical scoring.
*   **Historical Benchmarking:** Compare candidate performance against repository-wide benchmarks.

---

## 🔥 Key Feature Suite

| Feature | Description | Technology |
| :--- | :--- | :--- |
| **Live AI Overlay** | Real-time sentiment indicators visible to the interviewer only. | OpenCV / TensorFlow |
| **Biometric Auth** | Secure login flow for interviewers and candidates. | JWT / SHA-256 |
| **Interactive Coding** | Integrated collaborative tools for technical evaluation. | React Context API |
| **Smart Dashboards** | Role-based views for Interviewers (Analytics) and Candidates (Prep). | Tailwind CSS / Framer Motion |
| **Session Analytics** | Detailed timeline of emotional shifts during the interview. | Chart.js / Python Scoring API |

---

## 🛠️ Development Setup

### Backend (FastAPI)
1. Navigate to root: `cd TruthLens`
2. Create virtual environment: `python -m venv venv`
3. Activate: `source venv/bin/activate` (Mac/Linux)
4. Install dependencies: `pip install -r requirements.txt`
5. Launch server: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`

### Frontend (React)
1. Navigate to frontend: `cd frontend`
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`

---

## 🛡️ Security & Privacy
*   **End-to-End Privacy:** Emotion analysis data is processed session-locally and is encrypted before storage.
*   **Role-Based Access (RBAC):** Strict separation between candidate data and interviewer metrics.

## 📈 Roadmap
- [ ] Multi-party panel interview support.
- [ ] GPT-4 integration for automated technical question generation.
- [ ] Voice stress analysis (Audio-based AI).
- [ ] Integration with major ATS (Applicant Tracking Systems).

---

**Developed for the future of recruitment.** 
*Contact: [2601harshitraj@gmail.com](mailto:2601harshitraj@gmail.com)*
