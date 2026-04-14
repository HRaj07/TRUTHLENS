import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 bg-grid flex flex-col items-center justify-center p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-24 h-24 bg-danger-500/10 rounded-3xl flex items-center justify-center border border-danger-500/30 mb-8"
      >
        <ShieldAlert className="w-12 h-12 text-danger-400" />
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tighter"
      >
        404
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold text-slate-300 mb-6 uppercase tracking-widest">
          Sector Not Found
        </h2>
        <p className="text-slate-500 max-w-md mx-auto mb-12 leading-relaxed">
          The coordinates you've provided do not exist within the TruthLens behavioral matrix. 
          Return to base for recalibration.
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex gap-4"
      >
        <button 
          onClick={() => navigate(-1)}
          className="btn-secondary px-8 flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          Go Back
        </button>
        <button 
          onClick={() => navigate('/')}
          className="btn-primary px-8 flex items-center gap-2"
        >
          <Home className="w-5 h-5" />
          Base Home
        </button>
      </motion.div>

      {/* Background Glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-danger-500/5 rounded-full blur-[120px] pointer-events-none"></div>
    </div>
  );
};

export default NotFound;
