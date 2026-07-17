import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Download, 
  Share2, 
  Calendar, 
  Clock, 
  Target, 
  Activity, 
  ShieldCheck, 
  ArrowLeft,
  PieChart as PieIcon,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { sessionAPI } from '../services/api';

const COLORS = ['#38bdf8', '#10b981', '#f87171', '#fbbf24', '#a855f7', '#f472b6', '#94a3b8'];

const AnalyticsReport = () => {
  const { user } = useAuth();
  const { sessionCode } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await sessionAPI.getReport(sessionCode);
        setReport(data);
      } catch (err) {
        console.error('Failed to fetch report', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [sessionCode]);

  const handleDownloadPDF = async () => {
    try {
      const { downloadSessionPDF } = await import('../services/pdfUtils');
      downloadSessionPDF({
        sessionCode:     sessionCode,
        candidateName:   report.candidateName || report.candidate || 'Candidate',
        interviewerName: report.interviewerName || report.interviewer || 'Interviewer',
        duration:        report.duration || 0,
        aggregateStats:  report.aggregateStats || report.report?.aggregateStats || {},
        emotionHistory:  report.emotionHistory || report.report?.emotionHistory || [],
        endTime:         report.endTime || new Date().toISOString(),
      });
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('PDF generation failed. Please try again.');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-10">
       <div className="w-16 h-16 border-4 border-slate-800 border-t-neon-400 rounded-full animate-spin mb-6"></div>
       <div className="text-slate-400 font-bold uppercase tracking-widest text-sm">Collating Behavioral Data...</div>
    </div>
  );

  if (!report) return (
     <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-10 text-center">
        <ShieldCheck className="w-16 h-16 text-danger-400 mb-6 opacity-20" />
        <h2 className="text-2xl font-bold text-white mb-2">Report Not Found</h2>
        <p className="text-slate-500 mb-8">This session data may have expired or was never analyzed.</p>
        <button onClick={() => navigate(user?.role === 'interviewer' ? '/dashboard/interviewer' : '/dashboard/candidate')} className="btn-secondary">Return to Dashboard</button>
     </div>
  );

  const { aggregateStats, emotionHistory } = report;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans pb-20">
      {/* --- HEADER --- */}
      <header className="glass-dark border-b border-slate-800/50 py-6 px-6 sticky top-0 z-20">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
               <button 
                 onClick={() => navigate(user?.role === 'interviewer' ? '/dashboard/interviewer' : '/dashboard/candidate')} 
                 className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400"
                 title="Return to Homepage"
               >
                  <ArrowLeft className="w-5 h-5" />
               </button>
               <div>
                  <h1 className="text-xl font-black text-white uppercase tracking-tighter">Session Analytics</h1>
                  <p className="text-xs text-slate-500 font-bold">REPORT ID: {sessionCode || 'PROTOTYPE-001'}</p>
               </div>
            </div>

            <div className="flex gap-3">
               <button onClick={handleShareLink} className="btn-secondary py-2 flex items-center gap-2 text-sm border-slate-700">
                  <Share2 className="w-4 h-4" /> {copiedLink ? 'Copied!' : 'Share link'}
               </button>
               <button 
                onClick={handleDownloadPDF}
                className="btn-primary py-2 flex items-center gap-2 text-sm"
               >
                  <Download className="w-4 h-4" /> Export PDF
               </button>
            </div>
         </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12">
         {/* --- TOP OVERVIEW --- */}
         <div className="grid lg:grid-cols-3 gap-8 mb-12">
            
            {/* Dynamic Identity */}
            <div className="lg:col-span-2 card-dark flex flex-col md:flex-row gap-8 items-center p-8 border-slate-800">
               <div className="w-32 h-32 rounded-3xl bg-gradient-neon flex items-center justify-center text-4xl font-black text-white shadow-neon-strong shrink-0">
                  {((user?.role === 'interviewer' ? (report.candidateName || report.candidate) : (report.interviewerName || report.interviewer)) || 'Unknown').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
               </div>
               <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyber-500/10 text-cyber-400 text-[10px] font-black uppercase tracking-widest mb-4">
                     Verification Complete <CheckCircle2 className="w-3 h-3" />
                  </div>
                  <h2 className="text-4xl font-black text-white mb-2 leading-none">
                     {user?.role === 'interviewer' ? (report.candidateName || report.candidate) : (report.interviewerName || report.interviewer) || 'Unknown'}
                  </h2>
                  <p className="text-slate-400 font-medium mb-6">
                     {user?.role === 'interviewer' ? `Applied for: ${report.position || 'Unknown Role'}` : `Interviewer for: ${report.position || 'Unknown Role'}`}
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                     <div>
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Duration</div>
                        <div className="text-white font-mono flex items-center gap-2">
                           <Clock className="w-3.5 h-3.5 text-neon-400" /> 
                           {report.duration ? `${Math.floor(report.duration / 60)}:${String(report.duration % 60).padStart(2, '0')}` : '0:00'}
                        </div>
                     </div>
                     <div>
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Date</div>
                        <div className="text-white font-mono flex items-center gap-2">
                           <Calendar className="w-3.5 h-3.5 text-neon-400" /> 
                           {report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                        </div>
                     </div>
                     <div className="hidden md:block">
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">Consistency</div>
                        <div className="text-cyber-400 font-mono flex items-center gap-2"><Target className="w-3.5 h-3.5" /> High</div>
                     </div>
                  </div>
               </div>
            </div>

            {/* Overall Score */}
            <div className="card-dark border-neon-400/20 shadow-neon flex flex-col items-center justify-center text-center p-8 bg-neon-400/5">
                <div className="mb-4 text-[10px] font-black text-neon-400 uppercase tracking-[0.3em]">TruthLens Score</div>
                <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                   <svg className="w-full h-full -rotate-90">
                      <circle cx="64" cy="64" r="58" className="stroke-slate-800 fill-none" strokeWidth="12" />
                      <circle 
                        cx="64" cy="64" r="58" 
                        className="stroke-neon-400 fill-none transition-all duration-1000" 
                        strokeWidth="12" 
                        strokeDasharray={364}
                        strokeDashoffset={364 - (364 * aggregateStats.avgTruth)}
                        strokeLinecap="round"
                      />
                   </svg>
                   <span className="absolute text-3xl font-black text-white">{Math.round(aggregateStats.avgTruth * 100)}%</span>
                </div>
                <div className="text-xs font-bold text-slate-400">
                   Exceptional emotional consistency <br /> detected across all modules.
                </div>
            </div>
         </div>

         {/* --- DETAILED METRICS --- */}
         <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <ReportStat 
              label="Avg Confidence" 
              value={(aggregateStats.avgConfidence * 100).toFixed(1) + '%'} 
              desc="Model certainty rating"
              color="neon"
            />
            <ReportStat 
              label="Stress Impact" 
              value={(aggregateStats.avgStress * 100).toFixed(1) + '%'} 
              desc="Subconscious micro-stress"
              color="danger"
            />
            <ReportStat 
              label="Dominant State" 
              value={aggregateStats.dominantEmotion} 
              desc="Calculated emotional mode"
              color="cyber"
              uppercase
            />
            <ReportStat 
              label="Resilience" 
              value={(aggregateStats.consistencyScore * 100).toFixed(1) + '%'} 
              desc="Temporal stability"
              color="neon"
            />
         </div>

         {/* --- CHARTS SECTION --- */}
         <div className="grid lg:grid-cols-3 gap-8 mb-12">
            
            {/* Timeline Area Chart */}
            <div className="lg:col-span-2 card-dark border-slate-800 p-8">
               <div className="flex justify-between items-center mb-8">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-neon-400" />
                    Emotional Timeline
                  </h3>
                  <div className="flex gap-4 text-[10px] font-bold">
                     <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-neon-400"></span> Truth</div>
                     <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger-400"></span> Stress</div>
                  </div>
               </div>
               <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={emotionHistory}>
                        <defs>
                           <linearGradient id="colorTruth" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                           </linearGradient>
                           <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f87171" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} />
                        <Area type="monotone" dataKey="truth" stroke="#38bdf8" fillOpacity={1} fill="url(#colorTruth)" strokeWidth={2} />
                        <Area type="monotone" dataKey="stress" stroke="#f87171" fillOpacity={1} fill="url(#colorStress)" strokeWidth={2} />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Distribution Pie Chart */}
            <div className="card-dark border-slate-800 p-8 flex flex-col">
               <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2 mb-8">
                <PieIcon className="w-4 h-4 text-neon-400" />
                Emotion Spread
               </h3>
               <div className="flex-1 min-h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                          data={Object.entries(aggregateStats.emotionCounts).map(([name, value]) => ({ name, value }))}
                          cx="50%" cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                           {Object.entries(aggregateStats.emotionCounts).map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                           ))}
                        </Pie>
                        <Tooltip />
                     </PieChart>
                  </ResponsiveContainer>
               </div>
               <div className="grid grid-cols-2 gap-y-2 mt-4">
                  {Object.entries(aggregateStats.emotionCounts).slice(0, 4).map(([name, val], i) => (
                    <div key={name} className="flex items-center gap-2 text-[10px] font-bold uppercase">
                       <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }}></span>
                       <span className="text-slate-500">{name}:</span>
                       <span className="text-white">{val}</span>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         {/* --- SECTION: DETAILED BREAKDOWN --- */}
         <div className="card-dark border-slate-800 p-0 overflow-hidden">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center">
               <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Event Logs & Commentary</h3>
               <button className="text-xs text-neon-400 font-bold uppercase tracking-widest flex items-center gap-1">
                 <Search className="w-3.5 h-3.5" /> Full Audit Trail
               </button>
            </div>
            <div className="overflow-x-auto">
               <table className="table-dark">
                  <thead>
                     <tr>
                        <th>Timestamp</th>
                        <th>Identified State</th>
                        <th>Confidence</th>
                        <th>Inference Engine Remarks</th>
                     </tr>
                  </thead>
                  <tbody>
                     {emotionHistory.slice(0, 8).map((entry, i) => (
                       <tr key={i}>
                          <td className="font-mono text-[10px] text-slate-500">{entry.label}</td>
                          <td>
                             <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wider border border-slate-700">
                                {entry.emotion}
                             </span>
                          </td>
                          <td>
                             <div className="flex items-center gap-2">
                                <div className="h-1.5 w-12 bg-slate-800 rounded-full overflow-hidden">
                                   <div className="h-full bg-neon-400" style={{ width: `${entry.confidence}%` }}></div>
                                </div>
                                <span className="text-[10px] font-bold">{Math.round(entry.confidence)}%</span>
                             </div>
                          </td>
                          <td className="text-xs text-slate-500 italic max-w-md truncate">
                             {getRemarkForEmotion(entry.emotion, entry.confidence)}
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </main>
    </div>
  );
};

const ReportStat = ({ label, value, desc, color, uppercase = false }) => {
  const colorMap = {
     neon: 'text-neon-400',
     cyber: 'text-cyber-400',
     danger: 'text-danger-400'
  };

  return (
    <div className="card-dark border-slate-800 hover:border-slate-700 transition-all p-6">
       <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">{label}</div>
       <div className={`text-3xl font-black mb-1 ${colorMap[color]} ${uppercase ? 'uppercase' : ''}`}>
          {value}
       </div>
       <div className="text-[10px] text-slate-600 font-medium">{desc}</div>
    </div>
  );
};

function getRemarkForEmotion(emotion, confidence) {
   if (confidence < 40) return "Low signal clarity; cross-referencing temporal data.";
   switch(emotion) {
      case 'happy': return "Positive feedback loop detected; high candidate engagement.";
      case 'neutral': return "Default baseline established; objective signal processing.";
      case 'sad': return "Micro-expressions indicate potential empathetic response or fatigue.";
      case 'fear': return "Stress spike detected; likely triggered by high-complexity query.";
      case 'angry': return "Dominant focus shift; high intensity state identified.";
      default: return "Analyzed behavioral signal within expected probability deviation.";
   }
}

export default AnalyticsReport;
