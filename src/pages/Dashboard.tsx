import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Calendar, Image as ImageIcon, Zap, Crown, BarChart2, Download, FileText } from 'lucide-react';
import { StatisticsModal } from '../components/StatisticsModal';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, deleteDoc, doc } from 'firebase/firestore';

const MODELS = [
  { id: 'auto', name: 'Auto (Best Effort)' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' }
];

export const Dashboard: React.FC = () => {
  const { userData } = useAuth();
  const [showStats, setShowStats] = useState(false);
  const [logs, setLogs] = useState([]);
  const [modelStats, setModelStats] = useState({});
  const [csvExports, setCsvExports] = useState<any[]>([]);
  const [loadingExports, setLoadingExports] = useState(true);

  useEffect(() => {
    try {
      setLogs(userData?.appData?.logs || JSON.parse(localStorage.getItem('parrarel_logs_v1') || '[]'));
      setModelStats(userData?.appData?.modelStats || JSON.parse(localStorage.getItem('parrarel_stats_v1') || '{}'));
    } catch {}
  }, [userData]);

  useEffect(() => {
    if (!userData) return;
    const fetchExports = async () => {
      try {
        const q = query(
          collection(db, 'csv_exports'),
          where('uid', '==', userData.uid)
        );
        const snapshot = await getDocs(q);
        const exports: any[] = [];
        const now = new Date();
        const deletePromises: Promise<void>[] = [];
        
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.createdAt) {
            const createdAtDate = data.createdAt.toDate();
            const daysOld = (now.getTime() - createdAtDate.getTime()) / (1000 * 3600 * 24);
            if (daysOld <= 7) {
              exports.push({ id: docSnap.id, ...data });
            } else {
              deletePromises.push(deleteDoc(doc(db, 'csv_exports', docSnap.id)));
            }
          }
        });
        
        await Promise.all(deletePromises);
        exports.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
        setCsvExports(exports);
      } catch (err) {
        console.error("Error fetching exports:", err);
      } finally {
        setLoadingExports(false);
      }
    };
    fetchExports();
  }, [userData]);

  if (!userData) return null;

  const joinDate = new Date(userData.joinDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleDownloadCsv = (filename: string, csvData: string) => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <User className="w-8 h-8 text-purple-400" />
            My Dashboard
          </h1>
          <button
            onClick={() => setShowStats(true)}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all font-semibold flex items-center gap-2 border border-slate-700 hover:border-slate-600 shadow-lg"
          >
            <BarChart2 className="w-5 h-5" />
            View Statistics
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-xl backdrop-blur-sm">
            <div className="flex items-center gap-6">
              <img src={userData.photoURL || 'https://via.placeholder.com/100'} alt="Profile" className="w-24 h-24 rounded-2xl shadow-lg border-2 border-slate-700" />
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{userData.name}</h2>
                <p className="text-slate-400 mb-2">{userData.email}</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-sm font-medium text-slate-300">
                  <User className="w-4 h-4" />
                  {userData.nickname}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-3xl p-8 shadow-xl relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-colors"></div>
            <h3 className="text-slate-400 font-medium flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-amber-400" /> Current Plan
            </h3>
            <div className="text-4xl font-black text-white mb-2">
              {userData.unlimited ? 'Unlimited' : 'Standard'}
            </div>
            {!userData.unlimited && (
              <p className="text-slate-400">
                You are on the pay-as-you-go plan.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <Zap className="w-6 h-6" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {userData.unlimited ? '∞' : userData.credits}
            </div>
            <div className="text-slate-400 text-sm">Available Credits</div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {userData.totalProcessedImages || 0}
            </div>
            <div className="text-slate-400 text-sm">Images Processed</div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="text-xl font-bold text-white mb-1">
              {joinDate}
            </div>
            <div className="text-slate-400 text-sm">Member Since</div>
          </div>
        </div>
        
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-xl mt-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Download className="w-6 h-6 text-emerald-400" />
            Recent CSV Exports
          </h2>
          <p className="text-slate-400 text-sm mb-6">Exports are available for download for up to 7 days.</p>
          
          {loadingExports ? (
            <div className="text-center py-8 text-slate-500">Loading your exports...</div>
          ) : csvExports.length === 0 ? (
            <div className="text-center py-8 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
              No recent CSV exports found.
            </div>
          ) : (
            <div className="space-y-3">
              {csvExports.map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <FileText className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200">{exp.filename}</div>
                      <div className="text-xs text-slate-400">{exp.createdAt?.toDate().toLocaleString()}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDownloadCsv(exp.filename, exp.csvData)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                    title="Download CSV"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {showStats && (
        <StatisticsModal 
          logs={logs} 
          modelStats={modelStats} 
          models={MODELS} 
          onClose={() => setShowStats(false)} 
        />
      )}
    </div>
  );
};
