import React, { useEffect, useState } from 'react';
import { X, Activity, Calendar } from 'lucide-react';
import { UserData } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export const UserActivityModal: React.FC<{ user: UserData; onClose: () => void }> = ({ user, onClose }) => {
  const [todayCount, setTodayCount] = useState(0);
  const [weekCount, setWeekCount] = useState(0);
  const [monthCount, setMonthCount] = useState(0);
  
  const [startDate, setStartDate] = useState<Date | null>(new Date(new Date().setHours(0,0,0,0)));
  const [endDate, setEndDate] = useState<Date | null>(new Date(new Date().setHours(23,59,59,999)));
  const [customRangeCount, setCustomRangeCount] = useState(0);
  
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDefaultStats = async () => {
      try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Fetch this month's data to calculate month, week, and today locally to save reads
        const monthQuery = query(
            collection(db, 'users', user.uid, 'processingSessions'),
            where('completedAt', '>=', startOfMonth)
        );
        
        const snap = await getDocs(monthQuery);
        let tCount = 0;
        let wCount = 0;
        let mCount = 0;

        snap.forEach(doc => {
            const data = doc.data();
            const count = data.imageCount || 0;
            const completedAt = data.completedAt?.toDate();
            
            if (completedAt) {
                mCount += count;
                if (completedAt >= startOfWeek) {
                    wCount += count;
                }
                if (completedAt >= startOfToday) {
                    tCount += count;
                }
            }
        });

        setTodayCount(tCount);
        setWeekCount(wCount);
        setMonthCount(mCount);
      } catch (e) {
        console.error("Error fetching default activity stats", e);
      }
    };
    
    fetchDefaultStats();
  }, [user.uid]);

  useEffect(() => {
    const fetchCustomRangeAndHistory = async () => {
      if (!startDate || !endDate) return;
      setLoading(true);
      try {
        // Add 1 day to endDate to make it inclusive if it's set to midnight
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const customQuery = query(
            collection(db, 'users', user.uid, 'processingSessions'),
            where('completedAt', '>=', startDate),
            where('completedAt', '<=', end),
            orderBy('completedAt', 'desc')
        );

        const snap = await getDocs(customQuery);
        let cCount = 0;
        const hist: any[] = [];
        snap.forEach(doc => {
            const data = doc.data();
            cCount += (data.imageCount || 0);
            hist.push({
                id: doc.id,
                imageCount: data.imageCount || 0,
                completedAt: data.completedAt?.toDate()
            });
        });
        
        setCustomRangeCount(cCount);
        setHistory(hist);
      } catch (e) {
        console.error("Error fetching custom range activity", e);
      }
      setLoading(false);
    };

    fetchCustomRangeAndHistory();
  }, [user.uid, startDate, endDate]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
             <Activity className="w-5 h-5 text-purple-400" />
             <h2 className="text-xl font-bold text-white">User Activity: {user.email}</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-8">
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center flex flex-col justify-center">
               <div className="text-sm text-slate-400 mb-1">Total Processed</div>
               <div className="text-2xl font-bold text-emerald-400">{user.totalProcessedImages || 0}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center flex flex-col justify-center">
               <div className="text-sm text-slate-400 mb-1">Today</div>
               <div className="text-2xl font-bold text-blue-400">{todayCount}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center flex flex-col justify-center">
               <div className="text-sm text-slate-400 mb-1">This Week</div>
               <div className="text-2xl font-bold text-purple-400">{weekCount}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center flex flex-col justify-center">
               <div className="text-sm text-slate-400 mb-1">This Month</div>
               <div className="text-2xl font-bold text-amber-400">{monthCount}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center flex flex-col justify-center">
               <div className="text-sm text-slate-400 mb-1">Custom Range</div>
               <div className="text-2xl font-bold text-rose-400">{customRangeCount}</div>
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-800/50">
                  <h3 className="font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      Activity History
                  </h3>
                  <div className="flex items-center gap-2 text-sm z-50">
                      <DatePicker
                        selected={startDate}
                        onChange={(date: Date | null) => setStartDate(date)}
                        selectsStart
                        startDate={startDate || undefined}
                        endDate={endDate || undefined}
                        maxDate={new Date()}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 w-28 text-center focus:outline-none focus:border-purple-500"
                        placeholderText="Start Date"
                        dateFormat="MMM d, yyyy"
                      />
                      <span className="text-slate-500">to</span>
                      <DatePicker
                        selected={endDate}
                        onChange={(date: Date | null) => setEndDate(date)}
                        selectsEnd
                        startDate={startDate || undefined}
                        endDate={endDate || undefined}
                        minDate={startDate || undefined}
                        maxDate={new Date()}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 w-28 text-center focus:outline-none focus:border-purple-500"
                        placeholderText="End Date"
                        dateFormat="MMM d, yyyy"
                      />
                  </div>
              </div>

              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                      <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700/50">
                          <tr>
                              <th className="px-6 py-4 font-semibold">Date & Time</th>
                              <th className="px-6 py-4 font-semibold">Images Processed</th>
                              <th className="px-6 py-4 font-semibold text-slate-500">Session ID</th>
                          </tr>
                      </thead>
                      <tbody>
                          {loading ? (
                              <tr>
                                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">Loading history...</td>
                              </tr>
                          ) : history.length === 0 ? (
                              <tr>
                                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">No activity found in this date range.</td>
                              </tr>
                          ) : (
                              history.map((record) => (
                                  <tr key={record.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                          {record.completedAt ? record.completedAt.toLocaleString(undefined, {
                                              month: 'short', day: 'numeric', year: 'numeric',
                                              hour: '2-digit', minute: '2-digit'
                                          }) : 'Unknown'}
                                      </td>
                                      <td className="px-6 py-4 font-medium text-white">{record.imageCount}</td>
                                      <td className="px-6 py-4 font-mono text-[10px] text-slate-600 truncate max-w-[150px]">{record.id}</td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};
