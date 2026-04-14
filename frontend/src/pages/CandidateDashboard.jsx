import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Key, 
  HelpCircle, 
  ShieldCheck, 
  BrainCircuit,
  Video,
  Settings,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sessionAPI } from '../services/api';

const CandidateDashboard = () => {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [sessionCode, setSessionCode] = useState('');
  const [candidateName, setCandidateName] = useState(user?.name || '');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!sessionCode || !candidateName) {
      setError('Please enter both your name and the session code.');
      return;
    }
    
    setIsJoining(true);
    setError('');
    
    try {
      // Update profile with the entered name
      updateProfile({ name: candidateName });

      // Validate session code
      await sessionAPI.validate(sessionCode);
      
      // Small simulation delay
      setTimeout(() => {
        navigate(`/room/${sessionCode.toUpperCase()}`);
      }, 800);
    } catch (err) {
      setError('Invalid or expired interview code. Please verify with your recruiter.');
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans flex flex-col">
      {/* --- Top Nav --- */}
      <nav className="glass border-b border-slate-800/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-neon rounded flex items-center justify-center shadow-neon">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-black tracking-tighter text-white uppercase">TruthLens</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 text-slate-400 text-sm font-medium">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-neon-400">
                {user.avatar}
              </div>
              {user.name}
            </div>
            <button onClick={logout} className="text-slate-500 hover:text-danger-400 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* --- Main Area --- */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 lg:p-12 flex flex-col items-center justify-center">
        <div className="w-full max-w-2xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              Ready for your <span className="text-neon-400 px-2">Interview?</span>
            </h1>
            <p className="text-slate-400 text-lg">
              Enter the 6-character unique session code provided by your interviewer to begin the behavioral analysis session.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-8 md:p-12 border-neon-400/20 shadow-neon"
          >
            <form onSubmit={handleJoin} className="space-y-6">
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-4 text-center">
                    Your Full Name
                  </label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="ENTER YOUR NAME"
                      className="input-dark text-center text-xl font-bold tracking-wider"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-4 text-center">
                    Interview Access Code
                  </label>
                  <div className="relative group">
                    <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 w-6 h-6 group-focus-within:text-neon-400 transition-colors" />
                    <input 
                      type="text" 
                      value={sessionCode}
                      onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                      placeholder="E.G. XK1R9P"
                      maxLength={10}
                      className="w-full bg-slate-900 border-2 border-slate-800 text-white rounded-2xl px-16 py-6 text-2xl font-black tracking-[0.2em] focus:outline-none focus:border-neon-400/50 focus:ring-4 focus:ring-neon-400/10 transition-all uppercase placeholder:text-slate-700 placeholder:tracking-normal"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-danger-500/10 border border-danger-500/20 text-danger-400 px-4 py-3 rounded-xl text-sm font-medium text-center">
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isJoining || !sessionCode}
                className="btn-primary w-full py-6 text-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50"
              >
                {isJoining ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Join Interview Room
                    <ArrowRight className="w-6 h-6" />
                  </>
                )}
              </button>
            </form>
          </motion.div>

          {/* --- Instructions Grid --- */}
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            <InstructionCard 
              icon={Video}
              title="Camera Setup"
              text="Ensure your face is well-lit and clearly visible for analysis."
            />
            <InstructionCard 
              icon={BrainCircuit}
              title="Behavioral AI"
              text="AI will monitor expressions and stress levels in real-time."
            />
            <InstructionCard 
              icon={HelpCircle}
              title="Post-Review"
              text="A detailed behavioral report will be generated after completion."
            />
          </div>

          <div className="mt-12 text-center text-slate-600 text-sm">
            Problems joining? Contact <span className="text-slate-400 underline cursor-pointer hover:text-neon-400">system support</span> or reach out to your recruiter.
          </div>
        </div>
      </main>

      {/* --- Background Decorations --- */}
      <div className="fixed bottom-0 left-0 w-64 h-64 bg-neon-400/5 blur-[100px] pointer-events-none"></div>
      <div className="fixed top-20 right-0 w-96 h-96 bg-cyber-500/5 blur-[120px] pointer-events-none"></div>
    </div>
  );
};

const InstructionCard = ({ icon: Icon, title, text }) => (
  <div className="flex flex-col items-center text-center group">
    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 group-hover:border-neon-400/30 transition-colors">
      <Icon className="w-6 h-6 text-slate-500 group-hover:text-neon-400 transition-colors" />
    </div>
    <h3 className="text-white font-bold text-sm mb-2">{title}</h3>
    <p className="text-slate-500 text-xs leading-relaxed px-4">{text}</p>
  </div>
);

export default CandidateDashboard;
