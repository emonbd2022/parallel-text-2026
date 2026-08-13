import React, { useState } from 'react';
import { X, Activity, Calendar } from 'lucide-react';
import { UserData } from '../contexts/AuthContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export const UserActivityModal: React.FC<{ user: UserData; onClose: () => void }> = ({ user, onClose }) => {
  const [startDate, setStartDate] = useState<Date | null>(new Date(new Date().setHours(0,0,0,0)));
  const [endDate, setEndDate] = useState<Date | null>(new Date(new Date().setHours(23,59,59,999)));

  const totalProcessed = user.totalProcessedImages || 0;

  // Local calculation of summary metrics without querying Firestore
  const pad = (n: number) => n < 10 ? '0' + n : n;
  
  const getTodayStr = () => {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };

  const getHistoryForRange = () => {
    // Generate daily activity breakdown locally if stored in localStorage, or calculate summary
    const summaryStr = localStorage.getItem('userActivitySummary');
    let dailyMap: Record<string, number> = {};
    if (summaryStr) {
      try {
        const parsed = JSON.parse(summaryStr);
        if (parsed?.daily) dailyMap = parsed.daily;
      } catch {}
    }

    const history: { dateStr: string; date: Date; imageCount: number }[] = [];
    const end = endDate ? new Date(endDate) : new Date();
    if (endDate) end.setHours(23, 59, 59, 999);
    const start = startDate || new Date(0);

    Object.entries(dailyMap).forEach(([dateStr, count]) => {
      const [y, m, d] = dateStr.split('-');
      const date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
      if (date >= start && date <= end) {
        history.push({
          dateStr,
          date,
          imageCount: count
        });
      }
    });

    return history.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const history = getHistoryForRange();
  const todayStr = getTodayStr();

  // Local daily map
  const summaryStr = localStorage.getItem('userActivitySummary');
  let dailyMap: Record<string, number> = {};
  if (summaryStr) {
    try {
      const parsed = JSON.parse(summaryStr);
      if (parsed?.daily) dailyMap = parsed.daily;
    } catch {}
  }

  const todayCount = dailyMap[todayStr] || 0;
  
  // Calculate custom range sum locally
  const customCount = history.reduce((acc, h) => acc + h.imageCount, 0);

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
               <div className="text-2xl font-bold text-emerald-400">{totalProcessed}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center flex flex-col justify-center">
               <div className="text-sm text-slate-400 mb-1">Today</div>
               <div className="text-2xl font-bold text-blue-400">{todayCount}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center flex flex-col justify-center">
               <div className="text-sm text-slate-400 mb-1">Total Credits</div>
               <div className="text-2xl font-bold text-purple-400">{user.unlimited ? '∞' : user.credits}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center flex flex-col justify-center">
               <div className="text-sm text-slate-400 mb-1">Plan</div>
               <div className="text-2xl font-bold text-amber-400 capitalize">{user.plan || 'Free'}</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 text-center flex flex-col justify-center">
               <div className="text-sm text-slate-400 mb-1">Custom Range</div>
               <div className="text-2xl font-bold text-rose-400">{customCount}</div>
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-800/50">
                  <h3 className="font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      Daily Activity History
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
                              <th className="px-6 py-4 font-semibold">Date</th>
                              <th className="px-6 py-4 font-semibold">Images Processed</th>
                          </tr>
                      </thead>
                      <tbody>
                          {history.length === 0 ? (
                              <tr>
                                  <td colSpan={2} className="px-6 py-8 text-center text-slate-500">No local activity found in this date range. Total lifetime processed: {totalProcessed} images.</td>
                              </tr>
                          ) : (
                              history.map((record) => (
                                  <tr key={record.dateStr} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                                          {record.date.toLocaleDateString(undefined, {
                                              month: 'long', day: 'numeric', year: 'numeric'
                                          })}
                                      </td>
                                      <td className="px-6 py-4 font-bold text-white">{record.imageCount}</td>
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
