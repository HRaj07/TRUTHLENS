import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff,
  Video as VideoIcon, VideoOff,
  PhoneOff, MessageCircle, BarChart2, Monitor, Users,
  Brain, ChevronRight, ShieldAlert, Clock, Send, Activity,
  Maximize2, Settings, Download, Wifi, WifiOff, Copy, CheckCheck,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, AreaChart, Area,
} from 'recharts';

import { useAuth }      from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';
import { useWebRTC }    from '../hooks/useWebRTC';
import { useEmotionAnalysis } from '../hooks/useEmotionAnalysis';

// ─────────────────────────────────────────────────────────────
const InterviewRoom = () => {
  const { code }     = useParams();
  const navigate     = useNavigate();
  const { user, updateProfile } = useAuth();
  const {
    startSession, endSession,
    analyticsData, emotionHistory, aggregateStats,
    setParticipantNames,
    messages, sendMessage, receiveMessage, chatOpen, setChatOpen, unreadCount,
    micOn, setMicOn, cameraOn, setCameraOn, screenSharing, setScreenSharing,
    analyticsOpen, setAnalyticsOpen,
    currentQuestion, nextQuestion, currentQuestionIdx, questions,
  } = useInterview();

  const [sessionTime, setSessionTime] = useState(0);
  const [chatInput,   setChatInput]   = useState('');
  const [codeCopied,  setCodeCopied]  = useState(false);
  const [nameInput,   setNameInput]   = useState('');
  // Show name modal for anyone without a stored name
  const [showNameModal, setShowNameModal] = useState(!user?.name);
  const chatEndRef = useRef(null);

  // Effective user name — from auth context or from modal input
  const effectiveName = user?.name || nameInput;

  // ── WebRTC ────────────────────────────────────────────────
  // IMPORTANT: Pass '' as sessionCode while name modal is open.
  // useWebRTC's main effect guards on !sessionCode, so it won't
  // connect until the user has confirmed their name.
  const activeCode = showNameModal ? '' : code;

  const {
    localVideoRef, remoteVideoRef,
    remoteConnected, remoteName,
    toggleMic, toggleCamera,
    startScreenShare, stopScreenShare,
    captureFrameAsBlob,
    sendChatMessage,
    audioLevel, wsStatus, loading, error,
  } = useWebRTC({ 
    role: user.role, 
    sessionCode: activeCode, 
    userName: effectiveName,
    onChatMessage: (data) => receiveMessage(data.text, data.senderName, data.senderId)
  });

  // Emotion analysis on remote video (interviewer only, runs after room is live)
  useEmotionAnalysis({
    active:             !showNameModal && user.role === 'interviewer',
    captureFrameAsBlob,
    videoRef:           remoteVideoRef,
  });

  // ── Session timer ─────────────────────────────────────────
  useEffect(() => {
    startSession(code);
    const iv = setInterval(() => setSessionTime(p => p + 1), 1000);
    return () => { clearInterval(iv); endSession(); };
  }, [code, startSession, endSession]);

  // ── Sync names to context for persistence ──
  useEffect(() => {
    const cName = user.role === 'interviewer' ? remoteName : effectiveName;
    const iName = user.role === 'interviewer' ? effectiveName : remoteName;
    setParticipantNames(cName, iName);
  }, [user.role, effectiveName, remoteName, setParticipantNames]);

  // ── Auto-scroll chat ──────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Helpers ───────────────────────────────────────────────
  const handleToggleMic    = () => { toggleMic();    setMicOn(p => !p); };
  const handleToggleCamera = () => { toggleCamera(); setCameraOn(p => !p); };
  const handleToggleScreen = () => {
    if (screenSharing) stopScreenShare(); else startScreenShare();
    setScreenSharing(p => !p);
  };

  const copyCode = () => {
    const joinLink = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(joinLink).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput, effectiveName, user.id);
    sendChatMessage(chatInput, user.id, effectiveName);
    setChatInput('');
  };

  const handleDownloadPDF = useCallback(async () => {
    const { downloadSessionPDF } = await import('../services/pdfUtils');
    downloadSessionPDF({
      sessionCode:     code,
      candidateName:   user.role === 'interviewer' ? (remoteName || 'Candidate')   : effectiveName,
      interviewerName: user.role === 'interviewer' ? effectiveName : (remoteName || 'Interviewer'),
      duration:        sessionTime,
      aggregateStats,
      emotionHistory,
      endTime:         new Date().toISOString(),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, user, remoteName, sessionTime, aggregateStats, emotionHistory]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const remoteLabel = user.role === 'interviewer'
    ? `Candidate: ${remoteName || '—'}`
    : `Interviewer: ${remoteName || '—'}`;

  // ── Name confirm handler ──────────────────────────────────
  const handleConfirmName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    // Persist into auth context so the rest of the app (WebRTC, PDF) sees it
    updateProfile({ name: trimmed });
    setShowNameModal(false);
    // After this render: effectiveName = trimmed, activeCode = code
    // → useWebRTC connects with the correct name.
  };

  // ── Name entry modal (guard — shown BEFORE WebRTC connects) ──
  if (showNameModal) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 w-full max-w-md border-neon-400/20 shadow-neon"
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-neon rounded-2xl flex items-center justify-center shadow-neon">
              <Users className="text-white w-6 h-6" />
            </div>
            <div>
              <div className="text-white font-black text-xl">Join Interview Room</div>
              <div className="text-slate-500 text-xs mt-0.5">Session: <span className="text-neon-400 font-mono font-bold">{code}</span></div>
            </div>
          </div>

          {/* Role badge */}
          <div className={`mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest ${
            user.role === 'interviewer'
              ? 'bg-cyber-500/10 text-cyber-400 border border-cyber-500/30'
              : 'bg-neon-500/10 text-neon-400 border border-neon-400/30'
          }`}>
            <Brain className="w-3.5 h-3.5" />
            {user.role === 'interviewer' ? 'Interviewer' : 'Candidate'}
          </div>

          {/* Name input */}
          <div className="mb-8">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">
              Your Display Name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirmName()}
              placeholder="Enter your full name…"
              className="input-dark text-lg font-bold tracking-wide"
              autoFocus
            />
            <p className="text-slate-600 text-xs mt-2">This name appears on the other participant's screen and in the PDF report.</p>
          </div>

          {/* Confirm button */}
          <button
            onClick={handleConfirmName}
            disabled={!nameInput.trim()}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Activity className="w-4 h-4" />
            Enter Room
          </button>
        </motion.div>
      </div>
    );
  }
  // ── Render ────────────────────────────────────────────────
  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden text-slate-200 font-sans">

      {/* ── TOP BAR ─────────────────────────────────────────── */}
      <header className="h-16 glass-dark border-b border-slate-800/50 flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-neon rounded flex items-center justify-center shadow-neon">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="text-lg font-black tracking-tighter text-white uppercase hidden sm:inline">TruthLens</span>
          </div>
          <div className="h-6 w-px bg-slate-800 hidden sm:block" />
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-2 py-1 rounded">
              Session: {code}
            </span>
            <div className="flex items-center gap-2 text-neon-400 font-mono text-sm px-3 py-1 bg-neon-400/5 rounded-full border border-neon-400/10">
              <Clock className="w-3.5 h-3.5" />
              {formatTime(sessionTime)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* WS Connection status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium
            ${wsStatus === 'connected'
              ? 'border-cyber-500/30 bg-cyber-500/5 text-cyber-400'
              : 'border-danger-500/30 bg-danger-500/5 text-danger-400'}`}>
            {wsStatus === 'connected'
              ? <><Wifi className="w-3 h-3" /> Link Secure</>
              : <><WifiOff className="w-3 h-3" /> {wsStatus === 'error' ? 'Failed' : 'Connecting...'}</>}
          </div>

          {user.role === 'interviewer' && (
            <button onClick={handleDownloadPDF} className="btn-secondary py-1.5 px-4 text-xs flex items-center gap-2">
              <Download className="w-3.5 h-3.5" />
              Download Report
            </button>
          )}

          <button
            onClick={async () => { await endSession(); navigate(`/report/${code}`); }}
            className="btn-danger py-1.5 px-4 text-xs flex items-center gap-2"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            End Session
          </button>
        </div>
      </header>

      {/* ── MAIN STAGE ──────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── VIDEO + QUESTION AREA ───────────────────────── */}
        <div className="flex-1 flex flex-col gap-0 p-4 relative">

          {/* Error banner */}
          {error && (
            <div className="mb-3 px-4 py-3 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-400 text-sm font-medium">
              ⚠ {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-50 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-slate-800 border-t-neon-400 rounded-full animate-spin" />
                <p className="text-slate-400 text-sm font-medium">Setting up camera & microphone…</p>
              </div>
            </div>
          )}

          {/* ── REMOTE VIDEO (main panel) ────────────────── */}
          <div className="flex-1 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden group shadow-glass min-h-0">

            {/* Interviewer overlays */}
            {user.role === 'interviewer' && remoteConnected && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="absolute top-6 left-6 z-10 flex flex-col gap-3"
              >
                <div className="glass border-neon-400/20 px-4 py-2 rounded-xl flex items-center gap-3">
                  <Brain className="w-5 h-5 text-neon-400" />
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Emotion</div>
                    <div className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2">
                      {analyticsData.emotion}
                      <span className="live-dot-green" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Watermark */}
            <div className="absolute top-6 right-6 z-10 opacity-30 select-none">
              <div className="text-white text-[10px] font-bold tracking-[0.3em] uppercase">TRUTHLENS v2.0</div>
            </div>

            {/* ── Remote video element — ALWAYS IN DOM ──── */}
            {/*    Opacity controls visibility. This ensures  */}
            {/*    remoteVideoRef is never null when ontrack  */}
            {/*    fires, even before the peer connects.       */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-700"
              style={{ opacity: remoteConnected ? 1 : 0 }}
            />

            {/* Waiting overlay — shown on top until connected */}
            {!remoteConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center p-8 bg-slate-900 z-10">
                {/* Spinner */}
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-slate-800 border-t-neon-400 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity className="w-7 h-7 text-neon-400 opacity-60" />
                  </div>
                </div>

                <div>
                  <div className="text-white font-bold text-xl mb-1">
                    Waiting for {user.role === 'interviewer' ? 'candidate' : 'interviewer'}…
                  </div>
                  <div className="text-slate-500 text-sm">
                    {wsStatus === 'connected'
                      ? 'Room ready — share the session code to invite them'
                      : wsStatus === 'error'
                      ? '⚠ Could not connect to server — please reload'
                      : 'Connecting to signaling server…'}
                  </div>
                </div>

                {/* Session code + copy button */}
                {user.role === 'interviewer' && wsStatus === 'connected' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Share this session code
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-neon-400 font-mono text-sm sm:text-lg lg:text-xl font-black tracking-widest px-6 py-3 bg-neon-400/5 border border-neon-400/20 rounded-2xl break-all line-clamp-1">
                        {`${window.location.origin}/room/${code}`}
                      </div>
                      <button
                        onClick={copyCode}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-neon-400/40 text-slate-300 hover:text-neon-400 transition-all text-sm font-bold"
                      >
                        {codeCopied
                          ? <><CheckCheck className="w-4 h-4 text-cyber-400" /> Copied!</>
                          : <><Copy className="w-4 h-4" /> Copy</>}
                      </button>
                    </div>
                    <div className="text-xs text-slate-600">
                      Or candidate can enter code <span className="text-slate-400 font-mono font-bold">{code}</span> at <span className="text-slate-400 font-mono">/dashboard/candidate</span>
                    </div>
                  </div>
                )}

                {/* Candidate view: show who they're connecting to */}
                {user.role === 'candidate' && wsStatus === 'connected' && (
                  <div className="text-xs text-slate-600 mt-1">
                    Connected to room <span className="font-mono text-neon-400">{code}</span> — interviewer will join shortly
                  </div>
                )}
              </div>
            )}

            {/* Remote name label */}
            {remoteConnected && (
              <div className="absolute bottom-6 left-6 z-10 px-3 py-1.5 rounded-lg glass-dark border border-slate-800 text-xs font-bold text-white flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-neon-400" />
                {remoteLabel}
              </div>
            )}
          </div>

          {/* ── QUESTION CARD ────────────────────────────── */}
          <div className="h-44 mt-4 glass-card border-neon-400/10 flex items-center px-8 relative overflow-hidden shrink-0">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-400" />
            <div className="w-full">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold text-neon-400 uppercase tracking-[0.2em]">Active Behavioral Prompt</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">{currentQuestionIdx + 1} / {questions.length}</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.h2
                  key={currentQuestionIdx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-2xl font-bold text-white leading-tight pr-20"
                >
                  {currentQuestion}
                </motion.h2>
              </AnimatePresence>
            </div>
            {user.role === 'interviewer' && (
              <button
                onClick={nextQuestion}
                className="absolute right-8 btn-primary p-4 rounded-full flex items-center justify-center"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* ── LOCAL VIDEO PiP — bottom-right, like Zoom ─── */}
        <div
          className="absolute right-6 w-56 aspect-video rounded-2xl bg-slate-900 border-2 border-slate-700 shadow-2xl overflow-hidden z-20"
          style={{ bottom: '6.5rem' }}
        >
          {!cameraOn ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-900">
              <VideoOff className="w-8 h-8 text-slate-700" />
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
          )}
          {/* Audio level bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
            <div className="h-full bg-neon-400 transition-all duration-100" style={{ width: `${audioLevel}%` }} />
          </div>
          <div className="absolute top-2 right-2 px-2 py-0.5 bg-slate-950/70 rounded text-[9px] font-bold text-white uppercase tracking-widest backdrop-blur-sm">
            YOU: {effectiveName}
          </div>
        </div>

        {/* ── ANALYTICS PANEL (Interviewer Only) ──────── */}
        {user.role === 'interviewer' && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: analyticsOpen ? 420 : 0, opacity: analyticsOpen ? 1 : 0 }}
            className="glass-dark border-l border-slate-800/50 flex flex-col shrink-0 overflow-y-auto overflow-x-hidden"
          >
            <div className="p-6 min-w-[420px]">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                  <Brain className="w-4 h-4 text-neon-400" />
                  Neural Feed
                </h3>
                <button className="glass p-1.5 rounded bg-slate-800 border-slate-700">
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>

              {/* Score cards */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <MetricSquare label="TruthScore"   value={Math.round(analyticsData.truth * 100)}      color="cyber"  icon={ShieldAlert} />
                <MetricSquare label="Stress Level" value={Math.round(analyticsData.stress * 100)}     color="danger" icon={Activity} />
                <MetricSquare label="Confidence"   value={Math.round(analyticsData.confidence * 100)} color="neon"   icon={Brain} />
                <MetricSquare label="Consistency"  value={Math.round(aggregateStats.consistencyScore * 100)} color="neon" icon={Activity} />
              </div>

              {/* Confidence trend */}
              <div className="mb-8">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confidence Trend (60s)</span>
                  <span className="text-[10px] font-mono text-neon-400">FPS: 30 / POL: 3s</span>
                </div>
                <div className="h-40 w-full bg-slate-900/50 rounded-xl border border-slate-800/50 p-2 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={emotionHistory}>
                      <defs>
                        <linearGradient id="colorConf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis dataKey="label" hide />
                      <YAxis domain={[0, 100]} hide />
                      <ChartTooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '10px' }}
                      />
                      <Area type="monotone" dataKey="confidence" stroke="#38bdf8" fillOpacity={1} fill="url(#colorConf)" strokeWidth={2} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Emotion radar */}
              <div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Sentiment Distribution</div>
                <div className="h-64 w-full flex items-center justify-center bg-slate-900/30 rounded-2xl border border-slate-800/50">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%" cy="50%" outerRadius="70%"
                      data={Object.entries(analyticsData.emotionDistribution).map(([name, value]) => ({ name, value }))}
                    >
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                      <Radar name="Intensity" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Footer stats */}
            <div className="mt-auto p-6 bg-slate-900/80 border-t border-slate-800">
              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-3 tracking-widest">
                <span>DOMINANT EMOTION</span>
                <span className="text-white capitalize">{aggregateStats.dominantEmotion}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-3 tracking-widest">
                <span>FRAMES ANALYZED</span>
                <span className="text-white">{aggregateStats.totalFrames}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-2 tracking-widest">
                <span>CONSISTENCY SCORE</span>
                <span className="text-white">{(aggregateStats.consistencyScore * 100).toFixed(1)}%</span>
              </div>
              <div className="score-bar h-1.5">
                <div
                  className="score-bar-fill bg-gradient-to-r from-neon-400 to-cyber-400"
                  style={{ width: `${aggregateStats.consistencyScore * 100}%` }}
                />
              </div>
            </div>
          </motion.aside>
        )}

        {/* ── CHAT PANEL ──────────────────────────────── */}
        <AnimatePresence>
          {chatOpen && (
            <motion.aside
              initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
              className="w-96 glass-dark border-l border-slate-800 flex flex-col z-30"
            >
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h4 className="font-bold text-sm tracking-wide flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-neon-400" />
                  Session Messenger
                </h4>
                <button onClick={() => setChatOpen(false)} className="text-slate-500 hover:text-white">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.senderId === user.id ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{msg.senderName}</span>
                      <span className="text-[9px] text-slate-700">{msg.timestamp}</span>
                    </div>
                    <div className={`px-4 py-2 rounded-2xl text-sm max-w-[85%] ${
                      msg.type === 'system'
                        ? 'bg-slate-800/50 text-slate-400 border border-slate-700 italic'
                        : msg.senderId === user.id
                        ? 'bg-neon-400 text-white rounded-tr-none'
                        : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-800">
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your message..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-neon-400/50"
                  />
                  <button type="submit" className="absolute right-2 top-2 p-1.5 text-neon-400 hover:bg-neon-400/10 rounded-lg transition-colors">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ── CONTROL BAR ─────────────────────────────────────── */}
      <footer className="h-24 bg-slate-950 border-t border-slate-800/50 px-6 flex items-center justify-between shrink-0">
        <div className="hidden md:flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Participant</span>
            <span className="text-sm font-bold text-white uppercase">
              {user.role === 'interviewer' ? (remoteName || 'Waiting...') : effectiveName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ControlButton icon={micOn ? Mic : MicOff}             active={micOn}          onClick={handleToggleMic}    title={micOn ? 'Mute' : 'Unmute'} />
          <ControlButton icon={cameraOn ? VideoIcon : VideoOff}  active={cameraOn}       onClick={handleToggleCamera} title={cameraOn ? 'Stop video' : 'Start video'} />
          <ControlButton icon={Monitor}                          active={screenSharing}  onClick={handleToggleScreen} title="Share screen" />
          <div className="w-px h-8 bg-slate-800 mx-2" />
          <ControlButton icon={MessageCircle} active={chatOpen}      badge={unreadCount > 0 ? unreadCount : null} onClick={() => setChatOpen(!chatOpen)} title="Chat" />
          {user.role === 'interviewer' && (
            <ControlButton icon={BarChart2} active={analyticsOpen} onClick={() => setAnalyticsOpen(!analyticsOpen)} title="Analytics" />
          )}
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-cyber-400 uppercase tracking-widest">Secure Room</span>
            <span className="text-[10px] text-slate-500">AES-256 E2E AUTHENTICATED</span>
          </div>
          <ShieldAlert className="w-8 h-8 text-slate-800" />
        </div>
      </footer>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
const ControlButton = ({ icon: Icon, active, onClick, badge, title }) => (
  <button
    onClick={onClick}
    title={title}
    className={`relative w-12 h-12 rounded-2xl border flex items-center justify-center transition-all ${
      active
        ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
        : 'bg-danger-500/10 border-danger-500/30 text-danger-500 hover:bg-danger-500/20'
    }`}
  >
    <Icon className="w-5 h-5" />
    {badge && (
      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-950">
        {badge}
      </span>
    )}
  </button>
);

const MetricSquare = ({ label, value, color, icon: Icon }) => {
  const colorMap = {
    neon:   'text-neon-400 border-neon-400/20 bg-neon-400/5',
    cyber:  'text-cyber-400 border-cyber-400/20 bg-cyber-400/5',
    danger: 'text-danger-400 border-danger-400/20 bg-danger-400/5',
  };
  return (
    <div className={`p-4 rounded-xl border ${colorMap[color] || colorMap.neon}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</span>
        <Icon className="w-4 h-4 opacity-50" />
      </div>
      <div className="text-2xl font-black">{value}%</div>
      <div className="mt-2 h-1 w-full bg-slate-900 rounded-full overflow-hidden">
        <div className="h-full bg-current opacity-60" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
};

export default InterviewRoom;
