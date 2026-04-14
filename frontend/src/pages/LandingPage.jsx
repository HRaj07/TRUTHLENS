import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Cpu, 
  BarChart3, 
  Video, 
  Zap, 
  BrainCircuit, 
  ArrowRight,
  ChevronRight,
  Fingerprint,
  Activity,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AnimatePresence } from 'framer-motion';

const LandingPage = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [showDemo, setShowDemo] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { staggerChildren: 0.15 } 
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const navLinks = [
    { name: 'Features', href: '#features' },
    { name: 'Technology', href: '#tech' },
    { name: 'About', href: '#about' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 bg-grid overflow-hidden">
      {/* --- Navigation --- */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-slate-800/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-neon rounded-lg flex items-center justify-center shadow-neon">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-white">
              TRUTH<span className="text-neon-400">LENS</span>
            </span>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            {navLinks.map(link => (
              <a key={link.name} href={link.href} className="hover:text-neon-400 transition-colors">{link.name}</a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex gap-4">
              <Link to="/login" onClick={logout} className="px-5 py-2 text-slate-300 font-medium hover:text-white transition-colors relative group">
                Login
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-neon-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
              </Link>
              <Link to="/signup" onClick={logout} className="btn-primary py-2 px-6 text-sm shadow-[0_0_20px_rgba(45,212,191,0.3)] hover:shadow-[0_0_30px_rgba(45,212,191,0.5)]">
                Sign Up
              </Link>
            </div>
            
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden glass border-b border-slate-800/50 absolute top-full left-0 w-full overflow-hidden"
            >
              <div className="flex flex-col p-6 gap-6">
                {navLinks.map(link => (
                  <a 
                    key={link.name} 
                    href={link.href} 
                    onClick={() => setIsMenuOpen(false)}
                    className="text-lg font-bold text-slate-300 hover:text-neon-400 transition-colors"
                  >
                    {link.name}
                  </a>
                ))}
                <div className="h-[1px] bg-slate-800/50 w-full"></div>
                <div className="flex flex-col gap-4">
                  <Link to="/login" onClick={() => { logout(); setIsMenuOpen(false); }} className="text-center py-3 text-slate-300 font-bold border border-slate-800 rounded-xl">
                    Login
                  </Link>
                  <Link to="/signup" onClick={() => { logout(); setIsMenuOpen(false); }} className="btn-primary text-center py-4 rounded-xl">
                    Get Started for Free
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* --- Hero Section --- */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden min-h-[90vh] flex flex-col justify-center">
        {/* Animated Tech Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#2dd4bf0a_1px,transparent_1px),linear-gradient(to_bottom,#2dd4bf0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none z-0"></div>

        {/* Highly Visible Animated Fluid Background Blobs */}
        <motion.div 
          animate={{ 
            x: [0, 200, 100, -100, 0],
            y: [0, -150, 150, -100, 0],
            scale: [1, 1.4, 0.8, 1.2, 1],
            rotate: [0, 90, 180, 270, 360]
          }}
          transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-neon-400/30 rounded-full blur-[140px] mix-blend-screen pointer-events-none z-0"
        />
        <motion.div 
          animate={{ 
            x: [0, -200, -100, 150, 0],
            y: [0, 200, -100, 150, 0],
            scale: [1, 1.3, 1.5, 0.9, 1],
            rotate: [360, 270, 180, 90, 0]
          }}
          transition={{ repeat: Infinity, duration: 25, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-1/4 w-[700px] h-[700px] bg-cyber-500/30 rounded-full blur-[150px] mix-blend-screen pointer-events-none z-0"
        />
        <motion.div 
          animate={{ 
            x: [0, 300, -300, 0],
            y: [0, -200, 250, 0],
            scale: [1, 1.5, 0.9, 1],
          }}
          transition={{ repeat: Infinity, duration: 30, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-blue-500/20 rounded-full blur-[160px] mix-blend-screen pointer-events-none z-0"
        />

        <motion.div 
          className="max-w-7xl mx-auto text-center relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-neon-400/20 mb-8">
            <span className="live-dot-green"></span>
            <span className="text-xs font-bold text-cyber-400 uppercase tracking-widest">v2.0 Beta Live</span>
            <ChevronRight className="w-3 h-3 text-slate-500" />
          </motion.div>

          <motion.h1 
            variants={itemVariants}
            className="text-5xl md:text-8xl font-black text-white tracking-tight mb-8 leading-[1.1]"
          >
            The Future of <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-neon-400 via-neon-300 to-cyber-400">
              Behavioral Intelligence
            </span>
          </motion.h1>

          <motion.p 
            variants={itemVariants}
            className="text-slate-400 text-lg md:text-xl max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            Next-generation interview platform powered by DNA-accurate facial analysis. 
            TruthLens combines CNN+LSTM architectures to decode human micro-expressions, 
            stress markers, and confidence in real-time.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link to="/signup" onClick={logout} className="btn-primary text-lg px-8 py-4 flex items-center justify-center gap-2 group shadow-[0_0_40px_rgba(45,212,191,0.4)]">
                Get Started for Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </Link>
            </motion.div>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowDemo(true)} className="btn-secondary text-lg px-8 py-4 flex items-center justify-center gap-2 glass border border-neon-400/30 hover:border-neon-400/70 hover:bg-neon-400/10 transition-all shadow-lg">
              Watch Demo
              <Video className="w-5 h-5 text-neon-400" />
            </motion.button>
          </motion.div>

          {/* Feature Badges */}
          <motion.div 
            variants={itemVariants}
            className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-80"
          >
            {[
              { icon: Zap, label: "Real-time Processing" },
              { icon: Cpu, label: "Advanced LSTM Model" },
              { icon: Fingerprint, label: "Biometric Validation" },
              { icon: BarChart3, label: "Detailed Analytics" }
            ].map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <f.icon className="w-6 h-6 text-neon-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{f.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* --- Features Grid --- */}
      <section id="features" className="py-24 px-6 bg-slate-900/50 relative border-t border-b border-slate-800/50 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 drop-shadow-lg">Enterprise-Grade Performance</h2>
            <div className="h-1 w-20 bg-gradient-to-r from-neon-400 to-cyber-400 mx-auto rounded-full shadow-[0_0_15px_rgba(45,212,191,0.5)]"></div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ staggerChildren: 0.2 }}
            className="grid md:grid-cols-3 gap-8"
          >
            <FeatureCard 
              icon={BrainCircuit}
              title="CNN + LSTM Dual Engine"
              description="Proprietary neural network architecture designed to capture both static facial features and temporal expression dynamics."
            />
            <FeatureCard 
              icon={BarChart3}
              title="Predictive Stress Scoring"
              description="Monitor candidate anxiety levels through subconscious micro-expressions, helping you identify true confidence."
            />
            <FeatureCard 
              icon={ShieldCheck}
              title="Integrity Assessment"
              description="Our TruthScore™ algorithm detects emotional inconsistencies between verbal responses and physical indicators."
            />
          </motion.div>
        </div>
      </section>

      {/* --- Technology Section --- */}
      <section id="tech" className="py-24 px-6 relative overflow-hidden bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Our Neural Architecture</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Combining state-of-the-art vision models with breakthrough behavioral research.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { 
                icon: Cpu, 
                title: "Ensemble Engine", 
                desc: "Simultaneous analysis across FER-2013 and AffectNet datasets ensuring 99.8% precision." 
              },
              { 
                icon: Activity, 
                title: "rPPG Biometrics", 
                desc: "Remote photoplethysmography tracks subconscious stress through microscopic skin pixel fluctuations." 
              },
              { 
                icon: ShieldCheck, 
                title: "Zero-Knowledge", 
                desc: "Data is anonymized at the edge. We never store identifying biometric markers, only derived metrics." 
              }
            ].map((item, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-400 group transition-all"
              >
                <div className="w-12 h-12 bg-cyan-400/10 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <item.icon className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Visual Showcase --- */}
      <section className="py-32 px-6 relative overflow-visible">
        {/* Deep Colored Ambient Glow highly visible */}
        <motion.div 
          animate={{ 
            x: [0, -200, 100, 0],
            y: [0, 100, -100, 0],
            scale: [1, 1.2, 0.9, 1]
          }}
          transition={{ repeat: Infinity, duration: 22, ease: "easeInOut" }}
          className="absolute top-1/2 right-0 w-[900px] h-[900px] bg-cyber-500/20 rounded-full blur-[160px] -translate-y-1/2 mix-blend-screen pointer-events-none z-0"
        />

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="max-w-7xl mx-auto card-glow overflow-visible relative group z-10"
        >
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="p-12 md:w-1/2 z-10 relative">
              <h3 className="text-4xl font-black text-white mb-6 leading-tight drop-shadow-md">Real-Time Interview Analytics</h3>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-neon-400/20 flex items-center justify-center mt-1">
                    <div className="w-2 h-2 rounded-full bg-neon-400"></div>
                  </div>
                  <p className="text-slate-400"><span className="text-white font-semibold">Live Heartbeat:</span> Non-intrusive monitoring of facial blood flow signatures.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-neon-400/20 flex items-center justify-center mt-1">
                    <div className="w-2 h-2 rounded-full bg-neon-400"></div>
                  </div>
                  <p className="text-slate-400"><span className="text-white font-semibold">Emotion Heatmapping:</span> Dynamic visualization of dominant emotional states.</p>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-neon-400/20 flex items-center justify-center mt-1">
                    <div className="w-2 h-2 rounded-full bg-neon-400"></div>
                  </div>
                  <p className="text-slate-400"><span className="text-white font-semibold">Session History:</span> Complete encrypted record of all behavioral data for post-match review.</p>
                </li>
              </ul>
              <Link to="/signup" onClick={logout} className="btn-primary inline-flex items-center gap-2">
                Experiment Now <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="md:w-1/2 relative min-h-[500px] w-full flex items-center justify-center perspective-1000">
               {/* 3D Composite Illustration */}
               
               {/* Base Portrait */}
               <motion.div 
                 animate={{ y: [0, -10, 0] }}
                 transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                 className="relative z-10 w-full max-w-[400px] aspect-[4/5] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl glass-dark"
               >
                  <img src="/candidate1.jpg" alt="Candidate Analysis" className="w-full h-full object-cover opacity-80" />
                  
                  {/* Facial Mesh Overlay */}
                  <div className="absolute top-[30%] left-[35%] w-[30%] h-[20%] border border-neon-400/40 rounded-3xl" />
                  <div className="absolute top-[35%] left-[40%] w-[5%] h-[5%] bg-neon-400/80 rounded-full shadow-neon" />
                  <div className="absolute top-[35%] right-[40%] w-[5%] h-[5%] bg-neon-400/80 rounded-full shadow-neon" />
                  
                  {/* Scanning Line Animation */}
                  <motion.div 
                    animate={{ top: ['0%', '100%', '0%'] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                    className="absolute left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-400 to-transparent shadow-[0_0_15px_rgba(192,132,252,0.8)] z-20"
                  />
                  
                  {/* Glass overlay text */}
                  <div className="absolute bottom-4 left-4 right-4 glass p-3 rounded-xl border border-neon-400/20 flex justify-between items-center backdrop-blur-md">
                     <div>
                       <div className="text-[10px] font-bold text-cyber-400 uppercase tracking-widest">Active Scan</div>
                       <div className="text-white text-sm font-black tracking-wide">Processing Emotive Vectors</div>
                     </div>
                     <div className="w-6 h-6 rounded-full border-2 border-dashed border-neon-400 animate-spin-slow"></div>
                  </div>
               </motion.div>

               {/* Metric Cards Floating */}
               <motion.div 
                 animate={{ y: [0, 15, 0] }}
                 transition={{ repeat: Infinity, duration: 8, ease: "easeInOut", delay: 1 }}
                 className="absolute -right-8 top-20 z-20 w-48 glass-dark border border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur-lg"
               >
                 <div className="flex justify-between items-center mb-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Truth Score</span>
                   <ShieldCheck className="w-3 h-3 text-neon-400" />
                 </div>
                 <div className="text-3xl font-black text-white">98<span className="text-lg text-slate-500">%</span></div>
                 <div className="mt-2 text-xs font-medium text-neon-400">+2.4% baseline variance</div>
               </motion.div>

               <motion.div 
                 animate={{ y: [0, -12, 0] }}
                 transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 2 }}
                 className="absolute -left-12 bottom-32 z-20 w-52 glass-dark border border-danger-500/20 bg-danger-500/5 rounded-2xl p-4 shadow-[0_10px_40px_rgba(248,113,113,0.1)] backdrop-blur-lg"
               >
                 <div className="flex justify-between items-center mb-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stress Level</span>
                   <Activity className="w-3 h-3 text-danger-400" />
                 </div>
                 <div className="flex items-end gap-2">
                   <div className="text-3xl font-black text-white">12<span className="text-lg text-slate-500">%</span></div>
                   <div className="h-6 w-16 mb-1 flex items-end gap-1">
                      <div className="w-1/3 bg-danger-400 h-2 rounded-t animate-pulse"></div>
                      <div className="w-1/3 bg-danger-400 h-4 rounded-t animate-pulse delay-75"></div>
                      <div className="w-1/3 bg-danger-400 h-1.5 rounded-t animate-pulse delay-150"></div>
                   </div>
                 </div>
               </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* --- About Section --- */}
      <section id="about" className="py-24 px-6 relative bg-slate-900/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="md:w-1/2"
          >
            <div className="inline-block px-4 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-6">Our Mission</div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight">Quantifying <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Human Potential.</span></h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              TruthLens was founded on a simple premise: technical skill is only half the story. Our mission is to provide global recruiting teams with objective, bias-free behavioral data, enabling them to discover the true culture-fits and future leaders.
            </p>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="text-3xl font-black text-white mb-1">500k+</div>
                <div className="text-slate-500 text-xs uppercase tracking-widest font-bold">Sessions Analyzed</div>
              </div>
              <div>
                <div className="text-3xl font-black text-white mb-1">99.2%</div>
                <div className="text-slate-500 text-xs uppercase tracking-widest font-bold">Client Satisfaction</div>
              </div>
            </div>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="md:w-1/2 relative"
          >
            <div className="relative z-10 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl aspect-video bg-slate-800">
               <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80" alt="Team collaborating" className="w-full h-full object-cover opacity-60 mix-blend-luminosity" />
               <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
               <div className="absolute bottom-6 left-6 right-6 p-6 glass rounded-xl border border-white/10">
                  <div className="text-white font-bold mb-1">Join the Revolution</div>
                  <div className="text-slate-400 text-xs italic">"Empowering the next generation of engineers with data-driven confidence."</div>
               </div>
            </div>
            {/* Background decorative square */}
            <div className="absolute -top-4 -right-4 w-24 h-24 border-t-2 border-r-2 border-cyan-400/30 rounded-tr-3xl"></div>
            <div className="absolute -bottom-4 -left-4 w-24 h-24 border-b-2 border-l-2 border-cyan-400/30 rounded-bl-3xl"></div>
          </motion.div>
        </div>
      </section>

      {/* --- Final CTA Section --- */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-400/5 to-transparent pointer-events-none"></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto rounded-[2rem] border border-slate-800 bg-slate-900/50 p-12 md:p-20 text-center relative overflow-hidden group shadow-2xl"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-400/50 to-transparent"></div>
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-neon-400/10 rounded-full blur-[80px]"></div>
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyber-500/10 rounded-full blur-[80px]"></div>

          <div className="relative z-10">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
                Ready to Transform Your <br />
                <span className="text-neon-400">Behavioral Hiring?</span>
              </h2>
              <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
                Join hundreds of forward-thinking companies using behavioral AI to build world-class teams with DNA-accurate confidence.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link to="/signup" onClick={logout} className="btn-primary text-lg px-10 py-4 flex items-center gap-3 shadow-[0_0_30px_rgba(45,212,191,0.3)] hover:shadow-[0_0_50px_rgba(45,212,191,0.5)]">
                  Get Started for Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <div className="text-slate-500 text-sm font-medium">
                  No credit card required • v2.0 Beta
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* --- Footer --- */}
      <footer className="py-12 border-t border-slate-800/50 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-50">
             <div className="w-6 h-6 bg-slate-400 rounded flex items-center justify-center">
                <ShieldCheck className="text-slate-900 w-4 h-4" />
             </div>
             <span className="text-lg font-bold text-white tracking-tighter">TRUTHLENS</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 TruthLens Behavioral AI. All rights reserved.</p>
          <div className="flex gap-6 text-slate-500 text-sm">
            <button type="button" onClick={() => alert("Privacy policy is currently being updated for TruthLens v2.0.")} className="hover:text-neon-400 transition-colors">Privacy</button>
            <button type="button" onClick={() => alert("Security overview is currently being updated for TruthLens v2.0.")} className="hover:text-neon-400 transition-colors">Security</button>
            <button type="button" onClick={() => alert("Please reach out to support@truthlens.ai for any inquiries.")} className="hover:text-neon-400 transition-colors">Contact</button>
          </div>
        </div>
      </footer>

      {/* --- Demo Video Modal --- */}
      <AnimatePresence>
        {showDemo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-slate-950/80 backdrop-blur-md"
            onClick={() => setShowDemo(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-5xl aspect-video bg-slate-900 border border-neon-400/30 rounded-2xl overflow-hidden shadow-neon-strong"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowDemo(false)}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-slate-900/60 flex items-center justify-center text-white hover:bg-neon-400 hover:text-slate-950 transition-colors backdrop-blur-sm border border-white/10"
              >
                ✕
              </button>
              <video 
                src="/demo.webm" 
                autoPlay 
                controls 
                loop 
                className="w-full h-full object-cover"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, description }) => (
  <motion.div 
    whileHover={{ y: -15, scale: 1.05 }}
    className="card-dark border border-slate-800 hover:border-cyan-400/50 hover:shadow-[0_0_40px_rgba(45,212,191,0.2)] transition-all group relative overflow-hidden"
  >
    <div className="absolute inset-0 bg-gradient-to-br from-neon-400/0 to-cyber-400/0 group-hover:from-neon-400/10 group-hover:to-cyber-400/10 transition-colors z-0 duration-500 pointer-events-none"></div>
    <div className="relative z-10">
      <div className="w-16 h-16 bg-slate-900 rounded-xl flex items-center justify-center mb-6 group-hover:bg-neon-400/20 group-hover:scale-110 transition-all border border-slate-700 shadow-lg">
        <Icon className="w-8 h-8 text-neon-400 group-hover:drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]" />
      </div>
      <h3 className="text-2xl font-black text-white mb-4 group-hover:text-neon-300 transition-colors">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-[15px]">
        {description}
      </p>
    </div>
  </motion.div>
);

export default LandingPage;
