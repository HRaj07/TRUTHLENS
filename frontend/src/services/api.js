import axios from 'axios';

// ============================================================
//  API CONFIGURATION
//  TODO: Update base URLs to your deployed FastAPI and Node.js backend
// ============================================================
const FASTAPI_BASE = process.env.REACT_APP_FASTAPI_URL || 'http://127.0.0.1:8000';
const NODE_BASE    = process.env.REACT_APP_NODE_URL    || 'http://127.0.0.1:3001';

// Axios instances
const fastapiClient = axios.create({
  baseURL: FASTAPI_BASE,
  timeout: 15000,
});

// Separate client with longer timeout for Face ID (model download can take ~90s)
const faceClient = axios.create({
  baseURL: FASTAPI_BASE,
  timeout: 120000,
});

const nodeClient = axios.create({
  baseURL: NODE_BASE,
  timeout: 10000,
});

// Attach auth token to every request
const attachAuth = (config) => {
  const userData = localStorage.getItem('truthlens_user');
  if (userData) {
    const { token } = JSON.parse(userData);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

fastapiClient.interceptors.request.use(attachAuth);
faceClient.interceptors.request.use(attachAuth);
nodeClient.interceptors.request.use(attachAuth);

// ============================================================
//  EMOTION ANALYSIS  (FastAPI)
// ============================================================
export const emotionAPI = {
  /**
   * Analyze a video frame for emotion detection.
   * TODO: Connect to FastAPI endpoint POST /analyze
   * @param {Blob} imageBlob - JPEG/PNG blob from canvas capture
   * @returns {{ emotion, confidence_score, stress, confidence, truth, emotion_distribution }}
   */
  analyzeFrame: async (imageBlob) => {
    const formData = new FormData();
    formData.append('file', imageBlob, 'frame.jpg');
    const response = await fastapiClient.post('/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Generate final PDF report.
   * TODO: Connect to FastAPI endpoint GET /generate-report
   */
  generateReport: async () => {
    const response = await fastapiClient.get('/generate-report');
    return response.data;
  },

  /**
   * Download the generated PDF file.
   * TODO: Update path if FastAPI serves PDF at a different endpoint
   */
  downloadReportPDF: () => {
    window.open(`${FASTAPI_BASE}/download-report`, '_blank');
  },
};

// ============================================================
//  AUTHENTICATION  (Node.js / FastAPI)
//  TODO: Implement auth endpoints in your backend
// ============================================================
export const authAPI = {
  login: async (credentials) => {
    const res = await fastapiClient.post('/api/auth/login', credentials);
    return res.data;
  },
  signup: async (userData) => {
    const res = await fastapiClient.post('/api/auth/signup', userData);
    return res.data;
  },
  faceLogin: async (data) => {
    const res = await faceClient.post('/api/auth/face-login', data);
    return res.data;
  },
  faceSignup: async (data) => {
    const res = await faceClient.post('/api/auth/face-signup', data);
    return res.data;
  },
  refresh: async (refreshToken) => null,
  logout: async () => null,
};

// ============================================================
//  INTERVIEW SESSIONS  (Node.js backend / MongoDB)
//  TODO: Implement sessions CRUD in your Node.js backend
// ============================================================
export const sessionAPI = {
  /**
   * Create a new interview session.
   * TODO: Connect to POST /api/sessions/create
   * @returns {{ sessionCode, sessionId, createdAt }}
   */
  create: async (metadata = {}) => {
    const response = await fastapiClient.post('/api/sessions/create', metadata);
    return response.data;
  },

  /**
   * Get list of all sessions for current interviewer.
   * TODO: Connect to GET /api/sessions
   */
  list: async () => {
    const response = await fastapiClient.get('/api/sessions');
    return response.data;
  },

  /**
   * Get single session details.
   * TODO: Connect to GET /api/sessions/:id
   */
  get: async (sessionCode) => {
    const response = await fastapiClient.get(`/api/sessions/${sessionCode}`);
    return response.data;
  },

  /**
   * Validate a session code (for candidates joining).
   * TODO: Connect to POST /api/sessions/validate
   */
  validate: async (code) => {
    const response = await fastapiClient.post('/api/sessions/validate', { code: code.toUpperCase() });
    if (response.data.error) {
      throw new Error(response.data.error);
    }
    return response.data;
  },

  /**
   * Save session results to MongoDB.
   * TODO: Connect to PUT /api/sessions/:id/results
   */
  saveResults: async (sessionCode, results) => {
    const response = await fastapiClient.post(`/api/sessions/${sessionCode}/results`, results);
    return response.data;
  },

  /**
   * Get analytics report for a completed session.
   * TODO: Connect to GET /api/sessions/:id/report
   */
  getReport: async (sessionCode) => {
    // Try to get from backend first
    try {
      const response = await fastapiClient.get(`/api/sessions/${sessionCode}`);
      if (response.data && !response.data.error) {
        // Merge session metadata (including createdAt) with the detailed report blob
        return { ...response.data, ...(response.data.report || {}) };
      }
    } catch (err) {
      console.warn('Backend fetch failed, trying fallback');
    }

    const stored = localStorage.getItem(`truthlens_report_${sessionCode}`);
    if (stored) return JSON.parse(stored);
    
    return MOCK_REPORT;
  },
};

// ============================================================
//  MOCK DATA FOR DEVELOPMENT
// ============================================================
// eslint-disable-next-line no-unused-vars
const MOCK_SESSIONS = [
  {
    sessionCode: 'ABC123',
    sessionId: 'sess_001',
    candidate: 'Sarah Connor',
    candidateEmail: 'sarah@example.com',
    position: 'Senior Frontend Engineer',
    status: 'completed',
    duration: 2847,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    scores: { confidence: 0.78, stress: 0.34, truth: 0.71 },
    dominantEmotion: 'neutral',
  },
  {
    sessionCode: 'XK9F7P',
    sessionId: 'sess_002',
    candidate: 'James Rivera',
    candidateEmail: 'james@example.com',
    position: 'Backend Engineer',
    status: 'completed',
    duration: 3210,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    scores: { confidence: 0.85, stress: 0.22, truth: 0.82 },
    dominantEmotion: 'happy',
  },
  {
    sessionCode: 'MP3T8C',
    sessionId: 'sess_003',
    candidate: 'Emily Zhang',
    candidateEmail: 'emily@example.com',
    position: 'ML Engineer',
    status: 'scheduled',
    duration: null,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    scores: null,
    dominantEmotion: null,
  },
  {
    sessionCode: 'WQ5L2N',
    sessionId: 'sess_004',
    candidate: 'Marcus Johnson',
    candidateEmail: 'marcus@example.com',
    position: 'DevOps Engineer',
    status: 'completed',
    duration: 1890,
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    scores: { confidence: 0.62, stress: 0.51, truth: 0.55 },
    dominantEmotion: 'neutral',
  },
  {
    sessionCode: 'RV7H4K',
    sessionId: 'sess_005',
    candidate: 'Anika Patel',
    candidateEmail: 'anika@example.com',
    position: 'Product Manager',
    status: 'scheduled',
    duration: null,
    createdAt: new Date().toISOString(),
    scores: null,
    dominantEmotion: null,
  },
];

const MOCK_REPORT = {
  sessionCode: 'DEMO',
  duration: 2400,
  aggregateStats: {
    totalFrames: 240,
    dominantEmotion: 'neutral',
    avgConfidence: 0.74,
    avgStress: 0.35,
    avgTruth: 0.68,
    consistencyScore: 0.72,
    emotionCounts: { neutral: 120, happy: 55, fear: 20, sad: 15, angry: 10, surprise: 15, disgust: 5 },
  },
  emotionHistory: Array.from({ length: 40 }, (_, i) => ({
    time: Date.now() - (40 - i) * 1000,
    label: `${Math.floor(i / 60)}:${String(i % 60).padStart(2, '0')}`,
    confidence: 60 + Math.random() * 30,
    stress: 20 + Math.random() * 40,
    truth: 50 + Math.random() * 35,
    emotion: ['neutral', 'happy', 'neutral', 'fear', 'neutral'][Math.floor(Math.random() * 5)],
  })),
};
