import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  UserCircle,
  Mail,
  Lock,
  Briefcase,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AuthPage = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectParams = searchParams.get('redirect');
  const modeParam = searchParams.get('mode');
  const isRoomRedirect = redirectParams && redirectParams.includes('/room/');

  const isSignupPath = location.pathname === '/signup' || modeParam === 'signup';
  const [isLogin, setIsLogin] = useState(!isSignupPath);

  React.useEffect(() => {
    setIsLogin(!isSignupPath);
  }, [isSignupPath]);

  const [role, setRole] = useState(isRoomRedirect ? 'candidate' : 'interviewer'); // 'interviewer' | 'candidate'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  const [authMode, setAuthMode] = useState('password'); // 'password' | 'face'
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [faceError, setFaceError] = useState('');

  // Stop camera when unmounting or switching to password mode
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  React.useEffect(() => {
    if (authMode === 'face') {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => { });
          }
        })
        .catch(err => setFaceError('Camera access denied or unavailable.'));
    } else {
      stopCamera();
    }
    return stopCamera;
  }, [authMode]);

  const { login, signup, faceLogin, faceSignup } = useAuth();
  const navigate = useNavigate();

  // Auto-scan polling for Face ID Login
  const isScanningRef = React.useRef(false); // prevent concurrent requests

  React.useEffect(() => {
    let intervalId;
    let isMounted = true;

    if (isLogin && authMode === 'face' && !authError && !isSubmitting) {
      intervalId = setInterval(async () => {
        if (isScanningRef.current) return;

        try {
          const image = captureFace();
          if (!image) return;

          isScanningRef.current = true;
          const btnStatus = document.getElementById('auto-scan-status');
          if (btnStatus) btnStatus.innerText = "Analyzing Face...";

          await faceLogin(image, role);

          if (!isMounted) return;

          if (redirectParams) {
            navigate(redirectParams);
          } else {
            navigate(role === 'interviewer' ? '/dashboard/interviewer' : '/dashboard/candidate');
          }
        } catch (err) {
          if (!isMounted) return;
          const btnStatus = document.getElementById('auto-scan-status');
          // Handle model still loading
          if (err.message && err.message.includes('MODEL_LOADING')) {
            if (btnStatus) btnStatus.innerText = "⏳ Engine starting up... (~60s)";
          } else if (err.message && err.message.includes('Face recognition engine is starting')) {
            if (btnStatus) btnStatus.innerText = "⏳ Engine starting up... (~60s)";
          } else {
            if (btnStatus) btnStatus.innerText = "No match. Hold still...";
          }
        } finally {
          isScanningRef.current = false;
        }
      }, 3000);
    }

    return () => {
      isMounted = false;
      isScanningRef.current = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLogin, authMode, authError, isSubmitting, role, navigate, redirectParams, faceLogin]);

  const captureFace = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85); // base64
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (authError) setAuthError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError('');

    try {
      if (authMode === 'face') {
        const image = captureFace();
        if (!image) throw new Error("Could not capture face image.");
        if (isLogin) {
          await faceLogin(image, role);
        } else {
          await faceSignup({ ...formData, role, image });
        }
      } else {
        if (isLogin) {
          await login(formData.email, formData.password, role);
        } else {
          await signup({ ...formData, role });
        }
      }
      if (redirectParams) {
        navigate(redirectParams);
      } else {
        navigate(role === 'interviewer' ? '/dashboard/interviewer' : '/dashboard/candidate');
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row relative overflow-hidden font-sans">
      {/* --- Left Design Section --- */}
      <div className="hidden md:flex md:w-1/2 bg-slate-900 border-r border-slate-800 p-16 flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute -top-20 -left-20 w-[600px] h-[600px] bg-neon-400/5 rounded-full blur-[100px] select-none"></div>
        <div className="absolute bottom-40 -right-20 w-80 h-80 bg-cyber-500/5 rounded-full blur-[80px] select-none"></div>

        <Link to="/" className="flex items-center gap-2 group z-10">
          <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-neon-400 -translate-x-1 group-hover:-translate-x-2 transition-all" />
          <span className="text-slate-400 group-hover:text-white transition-colors font-medium">Back to Home</span>
        </Link>

        <div className="z-10 relative">
          <div className="w-16 h-16 bg-gradient-neon rounded-2xl flex items-center justify-center shadow-neon-strong mb-10">
            <ShieldCheck className="text-white w-10 h-10" />
          </div>
          <h1 className="text-5xl font-black text-white leading-tight mb-6">
            Unlock Real-Time <br />
            <span className="text-neon-400">Behavioral Insights.</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md leading-relaxed">
            TruthLens simplifies technical assessments by providing objective, AI-driven behavioral metrics.
          </p>

          <div className="mt-12 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 glass rounded-lg flex items-center justify-center">
                <ShieldCheck className="text-neon-400 w-5 h-5" />
              </div>
              <span className="text-slate-300 font-medium">98.4% Accuracy Rating</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 glass rounded-lg flex items-center justify-center">
                <Briefcase className="text-neon-400 w-5 h-5" />
              </div>
              <span className="text-slate-300 font-medium">Enterprise Level Standards</span>
            </div>
          </div>
        </div>

        <div className="z-10 text-slate-500 text-sm flex gap-8">
          <span>Secure AES-256</span>
          <span>SOC2 Compliant</span>
          <span>© 2026</span>
        </div>
      </div>

      {/* --- Right Form Section --- */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-16 relative">
        {/* Mobile Logo */}
        <Link to="/" className="md:hidden absolute top-8 left-8 flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-neon rounded flex items-center justify-center shadow-neon">
            <ShieldCheck className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-black tracking-tighter text-white uppercase">TruthLens</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-3xl font-bold text-white mb-3">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-slate-400">
              Select your role to continue your journey.
            </p>
          </div>

          {/* Role Selector */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => { setRole('interviewer'); }}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all ${role === 'interviewer'
                  ? 'bg-neon-400/10 border-neon-400/50 ring-1 ring-neon-400/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
            >
              <UserCircle className={role === 'interviewer' ? 'text-neon-400' : 'text-slate-500'} />
              <div className="text-center">
                <div className={`text-sm font-bold uppercase tracking-wide ${role === 'interviewer' ? 'text-white' : 'text-slate-400'}`}>Interviewer</div>
                <div className="text-[10px] text-slate-500">I conduct sessions</div>
              </div>
            </button>
            <button
              onClick={() => { setRole('candidate'); }}
              className={`flex flex-col items-center gap-3 p-4 rounded-xl border transition-all ${role === 'candidate'
                  ? 'bg-neon-400/10 border-neon-400/50 ring-1 ring-neon-400/30'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
            >
              <User className={role === 'candidate' ? 'text-neon-400' : 'text-slate-500'} />
              <div className="text-center">
                <div className={`text-sm font-bold uppercase tracking-wide ${role === 'candidate' ? 'text-white' : 'text-slate-400'}`}>Candidate</div>
                <div className="text-[10px] text-slate-500">I join sessions</div>
              </div>
            </button>
          </div>

          {/* Auth Mode Toggle */}
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800 mb-6">
            <button
              onClick={(e) => { e.preventDefault(); setAuthMode('password'); }}
              className={`flex-1 py-2 text-xs font-bold uppercase rounded-md transition-all ${authMode === 'password' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Password
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setAuthMode('face'); }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold uppercase rounded-md transition-all ${authMode === 'face' ? 'bg-neon-400/20 text-neon-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <UserCircle className="w-4 h-4" /> Face ID
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Demo credentials hint */}
            {isLogin && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3 text-xs text-slate-400">
                <span className="text-neon-400 font-bold">Demo:</span> Use{' '}
                <button type="button" onClick={() => setFormData(f => ({ ...f, email: 'alex@interviewer.com', password: 'demo123' }))} className="text-neon-300 underline hover:text-white">alex@interviewer.com</button>{' '}or{' '}
                <button type="button" onClick={() => setFormData(f => ({ ...f, email: 'sam@candidate.com', password: 'demo123' }))} className="text-neon-300 underline hover:text-white">sam@candidate.com</button>{' '}/ <span className="font-mono">demo123</span>
              </div>
            )}
            <AnimatePresence mode='wait'>
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">Full Name</label>
                  <div className="relative mt-2">
                    <User className="absolute left-4 top-3.5 text-slate-500 w-5 h-5" />
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="John Doe"
                      className="input-dark !pl-12"
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {(
              /* Email is required for all signups AND password logins (but NOT Face ID login anymore) */
              !isLogin || authMode === 'password'
            ) && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">Email Address</label>
                <div className="relative mt-2">
                  <Mail className="absolute left-4 top-3.5 text-slate-500 w-5 h-5" />
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="name@company.com"
                    className="input-dark !pl-12"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            )}

            {authMode === 'password' ? (
              <div>
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Password</label>
                  {isLogin && <button type="button" className="text-xs font-semibold text-neon-400 hover:text-neon-300">Forgot?</button>}
                </div>
                <div className="relative mt-2">
                  <Lock className="absolute left-4 top-3.5 text-slate-500 w-5 h-5" />
                  <input
                    type="password"
                    name="password"
                    required
                    placeholder="••••••••"
                    className="input-dark !pl-12"
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            ) : (
              <div className="w-full aspect-video bg-slate-900 border border-neon-400/30 rounded-xl overflow-hidden relative">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                {faceError && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-danger-400 text-xs px-4 text-center">{faceError}</div>}
                <div className="absolute top-2 right-2 flex gap-1 pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-neon-400 animate-pulse"></div>
                </div>
                <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-neon-400/20 scale-90 rounded-3xl"></div>
                <div className="absolute bottom-4 left-0 w-full text-center text-[10px] text-neon-400/70 uppercase tracking-widest font-mono shadow-md bg-black/40 py-1">Position face cleanly in frame for capture</div>
              </div>
            )}

            {authError && (
              <div className="bg-danger-500/10 border border-danger-500/30 text-danger-400 text-xs py-3 px-4 rounded-lg flex items-center gap-2">
                <div className="w-1 h-1 bg-danger-500 rounded-full"></div>
                {authError}
              </div>
            )}

            {!(isLogin && authMode === 'face') && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full py-4 mt-4 flex items-center justify-center gap-2 group"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            )}

            {(isLogin && authMode === 'face') && (
              <div className="w-full py-4 mt-4 flex flex-col items-center justify-center gap-2 bg-neon-400/5 border border-neon-400/20 rounded-xl">
                <div className="flex items-center gap-3 text-neon-400 font-bold uppercase tracking-widest text-xs">
                  <div className="w-4 h-4 border-2 border-neon-400/30 border-t-neon-400 rounded-full animate-spin shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                  <span id="auto-scan-status">Auto-Scanning Face</span>
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest">Looking directly at the camera</div>
              </div>
            )}
          </form>

          <div className="mt-8 text-center text-slate-500 text-sm">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-neon-400 font-bold hover:underline"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </motion.div>
      </div>

      {/* --- Footer Links for Mobile --- */}
      <div className="md:hidden p-8 flex justify-center gap-6 opacity-40 grayscale filter">
        <Globe className="w-6 h-6 text-white" />
        <ShieldCheck className="w-6 h-6 text-white" />
        <Briefcase className="w-6 h-6 text-white" />
      </div>
    </div>
  );
};

export default AuthPage;
