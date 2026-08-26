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
  Globe,
  KeyRound,
  MailCheck,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

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

  const [role, setRole] = useState(isRoomRedirect ? 'candidate' : 'interviewer');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1=email, 2=otp, 3=new password
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);

  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (authError) setAuthError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError('');

    try {
      if (isLogin) {
        await login(formData.email, formData.password, role);
      } else {
        await signup({ ...formData, role });
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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotSubmitting(true);
    setForgotError('');
    setForgotMessage('');
    try {
      const res = await authAPI.forgotPassword(forgotEmail);
      setForgotMessage(res.message || 'OTP sent to your email!');
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setForgotSubmitting(true);
    setForgotError('');
    setForgotMessage('');
    try {
      await authAPI.verifyOtp(forgotEmail, otpCode);
      setForgotMessage('OTP verified! Set your new password.');
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setForgotError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    setForgotSubmitting(true);
    setForgotError('');
    setForgotMessage('');
    try {
      await authAPI.resetPassword(forgotEmail, otpCode, newPassword);
      setForgotMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotStep(1);
        setForgotEmail('');
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
        setForgotMessage('');
        setForgotError('');
        setIsLogin(true);
      }, 2000);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row relative overflow-hidden font-sans">
      {/* --- Left Design Section --- */}
      <div className="hidden md:flex md:w-1/2 bg-slate-900 border-r border-slate-800 p-16 flex-col justify-between relative overflow-hidden">
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
              onClick={() => setRole('interviewer')}
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
              onClick={() => setRole('candidate')}
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

          <form onSubmit={handleSubmit} className="space-y-5">


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
                      placeholder="Write your full name"
                      className="input-dark !pl-12"
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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

            <div>
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Password</label>
                {isLogin && <button type="button" onClick={() => { setShowForgotPassword(true); setForgotStep(1); setForgotError(''); setForgotMessage(''); }} className="text-xs font-semibold text-neon-400 hover:text-neon-300">Forgot?</button>}
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

            {authError && (
              <div className="bg-danger-500/10 border border-danger-500/30 text-danger-400 text-xs py-3 px-4 rounded-lg flex items-center gap-2">
                <div className="w-1 h-1 bg-danger-500 rounded-full"></div>
                {authError}
              </div>
            )}

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

      {/* Forgot Password Overlay */}
      <AnimatePresence>
        {showForgotPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {forgotStep === 1 && 'Reset Password'}
                    {forgotStep === 2 && 'Enter OTP'}
                    {forgotStep === 3 && 'New Password'}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">
                    {forgotStep === 1 && 'We\\'ll send a verification code to your email'}
                    {forgotStep === 2 && `Code sent to ${forgotEmail}`}
                    {forgotStep === 3 && 'Choose a strong new password'}
                  </p>
                </div>
                <button
                  onClick={() => { setShowForgotPassword(false); setForgotStep(1); setForgotError(''); setForgotMessage(''); }}
                  className="text-slate-500 hover:text-white transition-colors text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Progress Steps */}
              <div className="flex items-center gap-2 mb-8">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center gap-2 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      forgotStep >= step
                        ? 'bg-neon-400 text-slate-950'
                        : 'bg-slate-800 text-slate-500'
                    }`}>
                      {forgotStep > step ? '✓' : step}
                    </div>
                    {step < 3 && (
                      <div className={`flex-1 h-0.5 rounded transition-all ${
                        forgotStep > step ? 'bg-neon-400' : 'bg-slate-800'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Step 1: Email */}
              <AnimatePresence mode="wait">
                {forgotStep === 1 && (
                  <motion.form
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleForgotPassword}
                    className="space-y-5"
                  >
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">Email Address</label>
                      <div className="relative mt-2">
                        <Mail className="absolute left-4 top-3.5 text-slate-500 w-5 h-5" />
                        <input
                          type="email"
                          required
                          placeholder="Enter your registered email"
                          className="input-dark !pl-12"
                          value={forgotEmail}
                          onChange={(e) => { setForgotEmail(e.target.value); setForgotError(''); }}
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={forgotSubmitting} className="btn-primary w-full py-4 flex items-center justify-center gap-2">
                      {forgotSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><MailCheck className="w-5 h-5" /> Send OTP</>}
                    </button>
                  </motion.form>
                )}

                {/* Step 2: OTP */}
                {forgotStep === 2 && (
                  <motion.form
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleVerifyOtp}
                    className="space-y-5"
                  >
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">6-Digit OTP Code</label>
                      <div className="relative mt-2">
                        <KeyRound className="absolute left-4 top-3.5 text-slate-500 w-5 h-5" />
                        <input
                          type="text"
                          required
                          maxLength={6}
                          placeholder="Enter 6-digit code"
                          className="input-dark !pl-12 tracking-[0.5em] text-center text-lg font-mono"
                          value={otpCode}
                          onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setForgotError(''); }}
                        />
                      </div>
                      <p className="text-slate-500 text-xs mt-2 pl-1">Check your inbox and spam folder</p>
                    </div>
                    <button type="submit" disabled={forgotSubmitting || otpCode.length !== 6} className="btn-primary w-full py-4 flex items-center justify-center gap-2">
                      {forgotSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ShieldCheck className="w-5 h-5" /> Verify OTP</>}
                    </button>
                    <button type="button" onClick={() => { setForgotStep(1); setOtpCode(''); setForgotError(''); setForgotMessage(''); }} className="w-full text-center text-sm text-slate-500 hover:text-neon-400 transition-colors flex items-center justify-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" /> Resend OTP
                    </button>
                  </motion.form>
                )}

                {/* Step 3: New Password */}
                {forgotStep === 3 && (
                  <motion.form
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleResetPassword}
                    className="space-y-5"
                  >
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">New Password</label>
                      <div className="relative mt-2">
                        <Lock className="absolute left-4 top-3.5 text-slate-500 w-5 h-5" />
                        <input
                          type="password"
                          required
                          minLength={6}
                          placeholder="Min 6 characters"
                          className="input-dark !pl-12"
                          value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); setForgotError(''); }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest pl-1">Confirm Password</label>
                      <div className="relative mt-2">
                        <Lock className="absolute left-4 top-3.5 text-slate-500 w-5 h-5" />
                        <input
                          type="password"
                          required
                          minLength={6}
                          placeholder="Re-enter password"
                          className="input-dark !pl-12"
                          value={confirmPassword}
                          onChange={(e) => { setConfirmPassword(e.target.value); setForgotError(''); }}
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={forgotSubmitting} className="btn-primary w-full py-4 flex items-center justify-center gap-2">
                      {forgotSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><KeyRound className="w-5 h-5" /> Reset Password</>}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Messages */}
              {forgotError && (
                <div className="mt-4 bg-danger-500/10 border border-danger-500/30 text-danger-400 text-xs py-3 px-4 rounded-lg flex items-center gap-2">
                  <div className="w-1 h-1 bg-danger-500 rounded-full" />
                  {forgotError}
                </div>
              )}
              {forgotMessage && (
                <div className="mt-4 bg-neon-400/10 border border-neon-400/30 text-neon-400 text-xs py-3 px-4 rounded-lg flex items-center gap-2">
                  <div className="w-1 h-1 bg-neon-400 rounded-full" />
                  {forgotMessage}
                </div>
              )}

              {/* Back to Login */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => { setShowForgotPassword(false); setForgotStep(1); setForgotError(''); setForgotMessage(''); }}
                  className="text-sm text-slate-500 hover:text-white transition-colors"
                >
                  ← Back to Login
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
