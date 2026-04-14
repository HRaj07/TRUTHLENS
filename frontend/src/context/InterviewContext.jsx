import React, { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect } from 'react';

const InterviewContext = createContext(null);

const INITIAL_EMOTION_STATE = {
  emotion: 'neutral',
  confidence: 0,
  stress: 0,
  truth: 0,
  emotionDistribution: {
    angry: 0, disgust: 0, fear: 0, happy: 0, neutral: 1, sad: 0, surprise: 0,
  },
};

export function InterviewProvider({ children }) {
  // ── Session meta ──────────────────────────────────────────────
  const [sessionCode, setSessionCode] = useState('');
  const [sessionStatus, setSessionStatus] = useState('idle'); // idle | waiting | active | ended
  const [startTime, setStartTime] = useState(null);
  const [duration, setDuration] = useState(0);
  const [candidateName, setCandidateName] = useState('');
  const [interviewerName, setInterviewerName] = useState('');

  // ── AI Analytics ──────────────────────────────────────────────
  const [analyticsData, setAnalyticsData] = useState(INITIAL_EMOTION_STATE);
  const [emotionHistory, setEmotionHistory] = useState([]); // { time, emotion, confidence, stress, truth }
  const [aggregateStats, setAggregateStats] = useState({
    totalFrames: 0,
    dominantEmotion: 'neutral',
    avgConfidence: 0,
    avgStress: 0,
    avgTruth: 0,
    emotionCounts: {},
    consistencyScore: 0,
  });

  // ── Chat ──────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  // ── Controls ──────────────────────────────────────────────────
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  // ── Questions ─────────────────────────────────────────────────
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [questions] = useState([
    'Tell me about yourself and your background.',
    'Why do you want to work at this company?',
    'What are your greatest strengths?',
    'Describe a challenging situation and how you overcame it.',
    'Where do you see yourself in 5 years?',
  ]);

  // ── Stabilization ─────────────────────────────────────────────
  // We use a ref to store the latest state so our callbacks (like endSession)
  // can remain stable even as data changes rapidly.
  const stateRef = useRef({ 
    sessionCode, startTime, analyticsData, emotionHistory, aggregateStats, messages,
    candidateName, interviewerName
  });
  
  useEffect(() => {
    stateRef.current = { 
      sessionCode, startTime, analyticsData, emotionHistory, aggregateStats, messages,
      candidateName, interviewerName
    };
  }, [sessionCode, startTime, analyticsData, emotionHistory, aggregateStats, messages, candidateName, interviewerName]);

  // Update analytics from frame analysis
  const updateAnalytics = useCallback((data) => {
    setAnalyticsData(data);

    const ts = Date.now();
    const entry = {
      time: ts,
      label: new Date(ts).toLocaleTimeString('en-US', { minute: '2-digit', second: '2-digit' }),
      emotion: data.emotion,
      confidence: Math.round(data.confidence * 100),
      stress: Math.round(data.stress * 100),
      truth: Math.round(data.truth * 100),
    };

    setEmotionHistory(prev => {
      const cutoff = Date.now() - 60000; // keep last 60 seconds
      const trimmed = [...prev.filter(e => e.time > cutoff), entry];
      return trimmed;
    });

    // Update aggregate stats
    setAggregateStats(prev => {
      const newTotal = prev.totalFrames + 1;
      const newAvgConf = ((prev.avgConfidence * prev.totalFrames) + data.confidence) / newTotal;
      const newAvgStress = ((prev.avgStress * prev.totalFrames) + data.stress) / newTotal;
      const newAvgTruth = ((prev.avgTruth * prev.totalFrames) + data.truth) / newTotal;
      const counts = { ...prev.emotionCounts, [data.emotion]: (prev.emotionCounts[data.emotion] || 0) + 1 };
      const dominant = Object.entries(counts).sort(([,a],[,b]) => b - a)[0]?.[0] || 'neutral';
      return {
        totalFrames: newTotal,
        dominantEmotion: dominant,
        avgConfidence: newAvgConf,
        avgStress: newAvgStress,
        avgTruth: newAvgTruth,
        emotionCounts: counts,
        consistencyScore: Math.max(0, 1 - newAvgStress),
      };
    });
  }, []);

  const startSession = useCallback((code) => {
    setSessionCode(code);
    setSessionStatus('active');
    setStartTime(Date.now());
    setEmotionHistory([]);
    setAggregateStats({
      totalFrames: 0, dominantEmotion: 'neutral',
      avgConfidence: 0, avgStress: 0, avgTruth: 0,
      emotionCounts: {}, consistencyScore: 0,
    });
    setMessages([{
      id: '0', type: 'system',
      text: 'Interview session started. Good luck! 🎯',
      timestamp: new Date().toLocaleTimeString(),
    }]);
  }, []);

  const endSession = useCallback(async () => {
    const { 
      sessionCode: sCode, 
      startTime: sTime, 
      analyticsData: aData, 
      emotionHistory: eHist, 
      aggregateStats: aStats, 
      messages: msgs,
      candidateName: cName,
      interviewerName: iName
    } = stateRef.current;

    setSessionStatus('ended');
    const now = Date.now();
    const dur = sTime ? Math.floor((now - sTime) / 1000) : 0;
    setDuration(dur);

    // Save final report data
    const report = {
      sessionCode: sCode,
      createdAt: sTime ? new Date(sTime).toISOString() : new Date().toISOString(),
      duration: dur,
      analyticsData: aData,
      emotionHistory: eHist,
      aggregateStats: aStats,
      messages: msgs,
      candidateName: cName,
      interviewerName: iName,
      endTime: new Date(now).toISOString(),
    };
    
    if (sCode) {
      // ✅ Save to backend
      try {
        const { sessionAPI } = await import('../services/api');
        await sessionAPI.saveResults(sCode, report);
      } catch (err) {
        console.error('Failed to save session results to backend', err);
      }
      
      // Keep localStorage as fallback/cache
      localStorage.setItem(`truthlens_report_${sCode}`, JSON.stringify(report));
    }
  }, []); // Completely stable!

  const setParticipantNames = useCallback((cName, iName) => {
    if (cName) setCandidateName(cName);
    if (iName) setInterviewerName(iName);
  }, []);

  const sendMessage = useCallback((text, senderName, senderId) => {
    const msg = {
      id: Date.now().toString(),
      text, senderId, senderName,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      type: 'user',
    };
    setMessages(prev => [...prev, msg]);
    if (!chatOpen) setUnreadCount(p => p + 1);
  }, [chatOpen]);

  const receiveMessage = useCallback((text, senderName, senderId) => {
    const msg = {
      id: Date.now().toString() + Math.random().toString(),
      text, senderId, senderName,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      type: 'remote',
    };
    setMessages(prev => [...prev, msg]);
    if (!chatOpen) setUnreadCount(p => p + 1);
  }, [chatOpen]);

  const openChat = useCallback(() => {
    setChatOpen(true);
    setUnreadCount(0);
  }, []);

  const nextQuestion = useCallback(() => {
    setCurrentQuestionIdx(p => Math.min(p + 1, questions.length - 1));
  }, [questions.length]);

  const prevQuestion = useCallback(() => {
    setCurrentQuestionIdx(p => Math.max(p - 1, 0));
  }, []);

  const value = useMemo(() => ({
    // Session
    sessionCode, setSessionCode,
    sessionStatus, startSession, endSession,
    startTime, duration,
    candidateName, interviewerName, setParticipantNames,
    // Analytics
    analyticsData, updateAnalytics,
    emotionHistory,
    aggregateStats,
    // Chat
    messages, sendMessage, receiveMessage,
    chatOpen, openChat, setChatOpen,
    unreadCount, setUnreadCount,
    // Controls
    micOn, setMicOn,
    cameraOn, setCameraOn,
    screenSharing, setScreenSharing,
    analyticsOpen, setAnalyticsOpen,
    // Questions
    questions, currentQuestionIdx,
    nextQuestion, prevQuestion,
    currentQuestion: questions[currentQuestionIdx],
  }), [
    sessionCode, sessionStatus, startTime, duration,
    analyticsData, emotionHistory, aggregateStats,
    messages, chatOpen, unreadCount,
    micOn, cameraOn, screenSharing, analyticsOpen,
    questions, currentQuestionIdx,
    candidateName, interviewerName,
    startSession, endSession, updateAnalytics, setParticipantNames, sendMessage, receiveMessage, openChat, nextQuestion, prevQuestion
  ]);

  return <InterviewContext.Provider value={value}>{children}</InterviewContext.Provider>;
}

export function useInterview() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error('useInterview must be inside InterviewProvider');
  return ctx;
}
