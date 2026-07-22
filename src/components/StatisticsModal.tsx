import React, { useState, useMemo } from 'react';
import { X, Calendar } from 'lucide-react';
import { ProcessingLog } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Cell } from 'recharts';

interface Props {
  logs: ProcessingLog[];
  modelStats: Record<string, { totalTimeMs: number, count: number, fails: number }>;
  models: { id: string, name: string }[];
  onClose: () => void;
}

export const StatisticsModal: React.FC<Props> = ({ logs, modelStats, models, onClose }) => {
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // Ensure logs are sorted
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 1. Daily, Weekly, Monthly total counts
    const stats = useMemo(() => {
        let daily = 0, weekly = 0, monthly = 0;
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = startOfDay - (now.getDay() * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        sortedLogs.forEach(log => {
            const time = new Date(log.timestamp).getTime();
            if (time >= startOfDay) daily += log.itemCount;
            if (time >= startOfWeek) weekly += log.itemCount;
            if (time >= startOfMonth) monthly += log.itemCount;
        });
        return { daily, weekly, monthly };
    }, [sortedLogs]);

    // 2. Custom Range Total
    const customRangeTotal = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return 0;
        const start = new Date(dateRange.start).getTime();
        const end = new Date(dateRange.end).getTime() + 24 * 60 * 60 * 1000; // include end day
        let total = 0;
        sortedLogs.forEach(log => {
            const time = new Date(log.timestamp).getTime();
            if (time >= start && time <= end) total += log.itemCount;
        });
        return total;
    }, [sortedLogs, dateRange]);

    // 3. Daily Activity Graph (last 14 days)
    const dailyData = useMemo(() => {
        const dataMap: Record<string, number> = {};
        const now = new Date();
        for (let i = 13; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            dataMap[dateStr] = 0;
        }
        
        sortedLogs.forEach(log => {
            const dateStr = new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            if (dataMap[dateStr] !== undefined) {
                dataMap[dateStr] += log.itemCount;
            }
        });

        return Object.keys(dataMap).map(date => ({ date, count: dataMap[date] }));
    }, [sortedLogs]);

    // 4. Time of Day Activity (Screen time like)
    const hourlyData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, label: `${i}:00` }));
        sortedLogs.forEach(log => {
            const h = new Date(log.timestamp).getHours();
            hours[h].count += log.itemCount;
        });
        return hours;
    }, [sortedLogs]);

    // 5. Model Efficiency
    const modelPerformance = useMemo(() => {
        const results = models.filter(m => m.id !== 'auto').map(m => {
            const stat = modelStats[m.id];
            const avgTime = stat && stat.count > 0 ? stat.totalTimeMs / stat.count : 0;
            const totalAttempts = stat ? (stat.count + stat.fails) : 0;
            const successRate = totalAttempts > 0 ? (stat.count / totalAttempts) * 100 : 0;
            const score = avgTime > 0 ? avgTime + ((stat?.fails || 0) * 5000) : 999999;
            return {
                id: m.id,
                name: m.name.split(' (')[0],
                avgTime,
                successRate,
                score,
                hasData: !!stat && stat.count > 0
            };
        }).filter(m => m.hasData);

        if (results.length === 0) return { best: null, worst: null };

        const sortedByScore = [...results].sort((a, b) => a.score - b.score);
        return {
            best: sortedByScore[0],
            worst: sortedByScore[sortedByScore.length - 1]
        };
    }, [modelStats, models]);

    // 6. Processing Time Trend
    const latencyData = useMemo(() => {
        const dataMap: Record<string, { totalMs: number, count: number }> = {};
        const now = new Date();
        for (let i = 13; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            dataMap[dateStr] = { totalMs: 0, count: 0 };
        }
        
        sortedLogs.forEach(log => {
            const dateStr = new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            if (dataMap[dateStr] !== undefined) {
                dataMap[dateStr].totalMs += log.durationMs;
                dataMap[dateStr].count += 1;
            }
        });
        
        return Object.keys(dataMap).map(date => ({ 
            date, 
            avgTimeSec: dataMap[date].count > 0 ? Number((dataMap[date].totalMs / dataMap[date].count / 1000).toFixed(1)) : 0 
        }));
    }, [sortedLogs]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-400" />
                        Processing Statistics
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                    
                    {/* Top Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                            <p className="text-sm font-semibold text-slate-400">Today</p>
                            <p className="text-3xl font-bold text-purple-400 mt-1">{stats.daily}</p>
                            <p className="text-xs text-slate-500 mt-1">images processed</p>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                            <p className="text-sm font-semibold text-slate-400">This Week</p>
                            <p className="text-3xl font-bold text-blue-400 mt-1">{stats.weekly}</p>
                            <p className="text-xs text-slate-500 mt-1">images processed</p>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                            <p className="text-sm font-semibold text-slate-400">This Month</p>
                            <p className="text-3xl font-bold text-emerald-400 mt-1">{stats.monthly}</p>
                            <p className="text-xs text-slate-500 mt-1">images processed</p>
                        </div>
                    </div>

                    {/* Custom Range */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 flex flex-col md:flex-row items-center gap-4 justify-between">
                        <div>
                            <h3 className="font-semibold text-slate-200">Custom Range Calculator</h3>
                            <p className="text-xs text-slate-500">Select a date range to see total images processed.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                value={dateRange.start} 
                                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                            />
                            <span className="text-slate-500">to</span>
                            <input 
                                type="date" 
                                value={dateRange.end} 
                                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-purple-500"
                            />
                            <div className="ml-4 bg-purple-900/40 border border-purple-500/30 px-4 py-1.5 rounded-lg">
                                <span className="font-bold text-purple-300">{customRangeTotal}</span>
                                <span className="text-xs text-purple-400 ml-1">images</span>
                            </div>
                        </div>
                    </div>

                    {/* Daily Activity Chart */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                        <h3 className="font-semibold text-slate-200 mb-4">Daily Activity (Last 14 Days)</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                                        itemStyle={{ color: '#c084fc' }}
                                    />
                                    <Line type="monotone" dataKey="count" stroke="#c084fc" strokeWidth={3} dot={{ fill: '#c084fc', strokeWidth: 2 }} activeDot={{ r: 6 }} name="Images" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Processing Time Trend Chart */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                        <h3 className="font-semibold text-slate-200 mb-4">Average Processing Time Trend (Last 14 Days)</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={latencyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}s`} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                                        itemStyle={{ color: '#10b981' }}
                                        formatter={(value: number) => [`${value}s`, 'Avg Latency']}
                                    />
                                    <Line type="monotone" dataKey="avgTimeSec" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', strokeWidth: 2 }} activeDot={{ r: 6 }} name="Avg Latency (s)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Time of Day Chart */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                        <h3 className="font-semibold text-slate-200 mb-4">When You Work (Activity by Hour)</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickMargin={10} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        cursor={{ fill: '#1e293b' }}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                                        itemStyle={{ color: '#38bdf8' }}
                                    />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Images">
                                        {hourlyData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#38bdf8' : '#1e293b'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Model Performance Summary */}
                    {modelPerformance.best && (
                        <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                            <h3 className="font-semibold text-slate-200 mb-4">Model Performance Summary</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Most Efficient</p>
                                        <p className="font-semibold text-slate-200 mt-1">{modelPerformance.best.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-mono text-emerald-400">{(modelPerformance.best.avgTime / 1000).toFixed(1)}s avg</p>
                                        <p className="text-xs text-slate-500">{modelPerformance.best.successRate.toFixed(1)}% success</p>
                                    </div>
                                </div>
                                {modelPerformance.worst && modelPerformance.worst.id !== modelPerformance.best.id && (
                                    <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-lg flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Least Reliable</p>
                                            <p className="font-semibold text-slate-200 mt-1">{modelPerformance.worst.name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-mono text-red-400">{(modelPerformance.worst.avgTime / 1000).toFixed(1)}s avg</p>
                                            <p className="text-xs text-slate-500">{modelPerformance.worst.successRate.toFixed(1)}% success</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
