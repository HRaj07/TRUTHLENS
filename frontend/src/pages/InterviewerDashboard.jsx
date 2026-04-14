import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Calendar, 
  Users, 
  Clock, 
  BarChart, 
  LogOut, 
  MoreVertical, 
  Search,
  Filter,
  Download,
  ShieldCheck,
  Video,
  TrendingUp,
  Settings,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sessionAPI } from '../services/api';

const InterviewerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await sessionAPI.list();
        setSessions(data);
      } catch (err) {
        console.error('Failed to fetch sessions', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const newSession = await sessionAPI.create({ 
        interviewerId: user.id,
        position: 'Senior Software Engineer' // Default for demo
      });
      // In a real app, we'd add to state or refetch
      setSessions([newSession, ...sessions]);
      // Small Delay before redirect for effect
      setTimeout(() => {
         navigate(`/room/${newSession.sessionCode}`);
      }, 1000);
    } catch (err) {
      console.error('Create session failed', err);
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed': return 'bg-cyber-500/10 text-cyber-400 border-cyber-500/20';
      case 'scheduled': return 'bg-neon-400/10 text-neon-400 border-neon-400/20';
      case 'active':    return 'bg-danger-500/10 text-danger-400 border-danger-500/20 animate-pulse';
      default:          return 'bg-slate-700/30 text-slate-400 border-slate-700/50';
    }
  };

  const handleFeatureAlert = (featureName) => {
    alert(`${featureName} feature is currently in preview and will be available in the next release.`);
  };

  const filteredSessions = sessions.filter(s => 
    (s.candidate || 'Unnamed Session').toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.sessionCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 flex font-sans">
      {/* --- Sidebar --- */}
      <aside className="hidden lg:flex w-72 bg-slate-900 border-r border-slate-800 flex-col py-8 px-6">
        <div className="flex items-center gap-2 mb-12 px-2">
          <div className="w-8 h-8 bg-gradient-neon rounded flex items-center justify-center shadow-neon">
            <ShieldCheck className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-black tracking-tighter text-white uppercase">TruthLens</span>
        </div>

        <nav className="flex-1 space-y-1">
          <SidebarItem icon={BarChart} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={Video} label="Room Templates" active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} />
          <SidebarItem icon={Clock} label="History" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <SidebarItem icon={Users} label="Candidates" active={activeTab === 'candidates'} onClick={() => setActiveTab('candidates')} />
          <SidebarItem icon={Settings} label="Project Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="mt-auto border-t border-slate-800 pt-6">
          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-neon-400 font-bold">
              {user.avatar}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-bold text-white truncate">{user.name}</div>
              <div className="text-xs text-slate-500 truncate">{user.company || 'Interviewer'}</div>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-2 text-slate-400 hover:text-danger-400 transition-colors text-sm font-medium w-full"
          >
            <LogOut className="w-4 h-4" />
            Logout Session
          </button>
        </div>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-10 flex flex-col">
        {activeTab === 'dashboard' && (
          <div className="flex-1">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Welcome Back, {user.name.split(' ')[0]}</h1>
                <p className="text-slate-500 font-medium">Monitoring {sessions.length} behavioral test sessions.</p>
              </div>
              <button 
                disabled={isCreating}
                onClick={handleCreateSession}
                className="btn-primary flex items-center gap-2"
              >
                {isCreating ? (
                   <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                   <>
                     <Plus className="w-5 h-5" />
                     Create New Session
                   </>
                )}
              </button>
            </header>

        {/* --- Stats Overview --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
           <StatCard icon={TrendingUp} label="Avg Resilience" value="84%" trend="+2.4%" />
           <StatCard icon={BarChart} label="Total Analyzed" value={sessions.length} trend="+12" />
           <StatCard icon={Users} label="Active Users" value="23" trend="0" />
           <StatCard icon={Clock} label="Avg Session" value="42m" trend="-5m" />
        </div>

        {/* --- Sessions Table Section --- */}
        <section className="card-dark p-0 overflow-hidden border-slate-800">
           <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Recent Session History
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-normal">Live Feed</span>
              </h2>
              <div className="flex gap-3">
                 <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input 
                      type="text" 
                      placeholder="Search sessions..." 
                      className="input-dark py-2 pl-10 text-sm w-full md:w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
                 <button onClick={() => handleFeatureAlert('Advanced Filters')} className="glass p-2 rounded-lg border-slate-700 hover:border-slate-600 transition-colors">
                    <Filter className="w-5 h-5 text-slate-400" />
                 </button>
              </div>
           </div>

           <div className="overflow-x-auto">
              <table className="table-dark">
                 <thead>
                    <tr>
                       <th>Candidate</th>
                       <th>Position</th>
                       <th>Date / Time</th>
                       <th>Status</th>
                       <th>Performance</th>
                       <th>Actions</th>
                    </tr>
                 </thead>
                 <tbody>
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i}>
                           <td colSpan="6" className="py-6 text-center text-slate-600 italic">
                              <div className="skeleton h-4 w-full rounded"></div>
                           </td>
                        </tr>
                      ))
                    ) : (
                      filteredSessions.map((sess) => (
                        <tr key={sess.sessionCode} onClick={() => sess.status === 'completed' && navigate(`/report/${sess.sessionCode}`)}>
                           <td className="font-bold text-white">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-neon-400">
                                    {(sess.candidate || '??').split(' ').map(n=>n[0]).join('')}
                                 </div>
                                 {sess.candidate || 'Unnamed Session'}
                              </div>
                           </td>
                           <td className="text-slate-400 text-xs">{sess.position}</td>
                           <td className="text-slate-400 text-xs">
                              {new Date(sess.createdAt).toLocaleDateString()} <br />
                              <span className="text-[10px] text-slate-600">{new Date(sess.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           </td>
                           <td>
                              <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${getStatusStyle(sess.status)}`}>
                                 {sess.status}
                              </span>
                           </td>
                           <td>
                              {sess.scores ? (
                                <div className="flex flex-col gap-1 w-24">
                                   <div className="flex justify-between text-[10px] font-bold">
                                      <span className="text-cyber-400">TRU {Math.round(sess.scores.truth * 100)}%</span>
                                      <span className="text-slate-500">RES {Math.round(sess.scores.confidence * 100)}%</span>
                                   </div>
                                   <div className="score-bar h-1">
                                      <div 
                                        className="score-bar-fill bg-cyber-500" 
                                        style={{ width: `${sess.scores.truth * 100}%` }}
                                      ></div>
                                   </div>
                                </div>
                              ) : (
                                <span className="text-slate-600 text-xs">Waiting...</span>
                              )}
                           </td>
                           <td>
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                 <button onClick={() => {
                                   if(sess.status === 'completed') navigate(`/report/${sess.sessionCode}`);
                                   else handleFeatureAlert('Live Monitoring Download');
                                 }} className="p-2 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-white transition-colors">
                                    <Download className="w-4 h-4" />
                                 </button>
                                 <button onClick={() => handleFeatureAlert('Session Options')} className="p-2 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-white transition-colors">
                                    <MoreVertical className="w-4 h-4" />
                                 </button>
                              </div>
                           </td>
                        </tr>
                      ))
                    )}
                 </tbody>
              </table>
           </div>

           <div className="p-4 bg-slate-900/40 border-t border-slate-800 text-center">
              <button onClick={() => setActiveTab('history')} className="text-slate-500 text-xs font-medium hover:text-neon-400 flex items-center gap-1 mx-auto">
                <Calendar className="w-3 h-3" /> View Full Archive <ChevronRight className="w-3 h-3" />
              </button>
           </div>
        </section>
          </div>
        )}

        {/* Tab Placeholders */}
        {activeTab === 'templates' && <PlaceholderTab title="Room Templates" icon={Video} description="Configure interview environments, adjust behavioral thresholds, and prepare AI settings for different engineering roles." />}
        {activeTab === 'history' && <PlaceholderTab title="Session History" icon={Clock} description="Access a complete log of your previous interviews, export DNA-accurate analyses, and view historical insights." />}
        {activeTab === 'candidates' && <PlaceholderTab title="Candidate Database" icon={Users} description="Manage candidate profiles, track aggregate performance over time, and correlate their emotional baseline metrics." />}
        {activeTab === 'settings' && <PlaceholderTab title="Project Settings" icon={Settings} description="Configure your TruthLens workspace, regenerate API keys, and assign internal team roles." />}
      </main>

      {/* --- Mobile Floating Action --- */}
      <button 
        onClick={handleCreateSession}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-neon-400 rounded-full shadow-neon-strong flex items-center justify-center text-white z-50 animate-bounce"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
};

const SidebarItem = ({ icon: Icon, label, active = false, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
    active 
    ? 'bg-neon-400/10 text-neon-400 border border-neon-400/20' 
    : 'text-slate-400 hover:text-white hover:bg-slate-800'
  }`}>
    <Icon className="w-5 h-5" />
    <span className="font-bold text-sm tracking-wide uppercase">{label}</span>
  </button>
);

const PlaceholderTab = ({ title, icon: Icon, description }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-4">
    <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center border border-slate-800 mb-8 shadow-neon relative group overflow-hidden">
      <div className="absolute inset-0 bg-neon-400/10 scale-0 group-hover:scale-100 transition-transform rounded-3xl"></div>
      <Icon className="w-10 h-10 text-neon-400 relative z-10" />
    </div>
    <h2 className="text-3xl md:text-5xl font-black text-white mb-6 uppercase tracking-tighter">{title}</h2>
    <p className="text-slate-400 max-w-md mx-auto leading-relaxed mb-10 text-sm md:text-base">{description}</p>
    <button onClick={() => alert(`${title} module is currently locked in your pricing tier or pending update.`)} className="btn-primary py-3 px-8 flex items-center gap-2 font-bold tracking-widest text-xs uppercase shadow-neon-strong">
       Unlock Module <ChevronRight className="w-4 h-4 ml-1" />
    </button>
  </div>
);

const StatCard = ({ icon: Icon, label, value, trend }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="card-dark p-5 border-slate-800 flex items-center justify-between"
  >
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-2xl font-black text-white">{value}</div>
      <div className={`text-[10px] mt-1 font-bold ${trend.startsWith('+') ? 'text-cyber-400' : trend === '0' ? 'text-slate-500' : 'text-danger-400'}`}>
        {trend} vs last period
      </div>
    </div>
    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800">
      <Icon className="w-6 h-6 text-slate-400" />
    </div>
  </motion.div>
);

export default InterviewerDashboard;
