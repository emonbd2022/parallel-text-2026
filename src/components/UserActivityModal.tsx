import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, getAggregateFromServer, sum, count } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { X, Activity } from 'lucide-react';
import { UserData } from '../contexts/AuthContext';

export const UserActivityModal: React.FC<{ user: UserData; onClose: () => void }> = ({ user, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [totalApiRequests, setTotalApiRequests] = useState(0);
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'activity_logs'), where('uid', '==', user.uid));
        const snap = await getDocs(q);
        
        const logs = snap.docs.map(d => d.data());
        
        // Count API requests (number of log entries is roughly number of export sessions/API calls)
        setTotalApiRequests(logs.length);

        // Aggregate by date
        const dailyData: Record<string, number> = {};
        logs.forEach(log => {
           if (log.timestamp) {
               const dateStr = log.timestamp.toDate().toISOString().split('T')[0];
               dailyData[dateStr] = (dailyData[dateStr] || 0) + (log.imagesProcessed || 0);
           }
        });

        const chartData = Object.keys(dailyData).sort().map(date => ({
           date,
           images: dailyData[date]
        }));
        
        setData(chartData);
      } catch (err) {
        console.error("Error fetching user activity:", err);
      }
      setLoading(false);
    };
    
    fetchData();
  }, [user.uid]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
             <Activity className="w-5 h-5 text-purple-400" />
             <h2 className="text-xl font-bold text-white">Activity: {user.email}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
           {loading ? (
              <div className="h-64 flex items-center justify-center text-slate-400">Loading activity data...</div>
           ) : (
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center">
                       <div className="text-sm text-slate-400 mb-1">Total API Export Sessions</div>
                       <div className="text-2xl font-bold text-white">{totalApiRequests}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center">
                       <div className="text-sm text-slate-400 mb-1">Total Processed Images</div>
                       <div className="text-2xl font-bold text-emerald-400">{user.totalProcessedImages || 0}</div>
                    </div>
                 </div>

                 <div className="bg-slate-950 rounded-xl p-4 border border-white/5">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 ml-2">Images Processed by Date</h3>
                    {data.length > 0 ? (
                        <div className="h-64 w-full">
                           <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={data}>
                               <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                               <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                               <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                               <Tooltip 
                                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                  itemStyle={{ color: '#a78bfa', fontWeight: 'bold' }}
                               />
                               <Line type="monotone" dataKey="images" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#a855f7', r: 4 }} activeDot={{ r: 6 }} />
                             </LineChart>
                           </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-500">No activity data available.</div>
                    )}
                 </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};
