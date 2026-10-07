import React, { useState, useMemo, useEffect } from 'react';
import { X, Calendar, Zap, Clock, Activity, CheckCircle, AlertTriangle, RotateCcw, Trash2, Cpu, Key, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ProcessingLog, ApiKey, ModelSpeedStat, ApiKeySpeedStat } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { performanceStats } from '../services/performanceStatsService';

interface Props {
  logs: ProcessingLog[];
  modelStats: Record<string, { totalTimeMs: number, count: number, fails: number }>;
  models: { id: string, name: string }[];
  localKeys?: ApiKey[];
  centralKeys?: ApiKey[];
  onClose: () => void;
}

export const StatisticsModal: React.FC<Props> = ({ logs, modelStats: propModelStats, models, localKeys = [], centralKeys = [], onClose }) => {
    const [activeTab, setActiveTab] = useState<'speed' | 'overview' | 'logs'>('speed');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [tick, setTick] = useState(0);

    // Live performance stats from performanceStatsService
    const [speedModelStats, setSpeedModelStats] = useState<Record<string, ModelSpeedStat>>(() => performanceStats.getModelStats());
    const [apiStats, setApiStats] = useState<Record<string, ApiKeySpeedStat>>(() => performanceStats.getApiStats());
    const [sessionExcluded, setSessionExcluded] = useState(() => performanceStats.getSessionExcludedKeys());
    const [sessionAttempted, setSessionAttempted] = useState(() => performanceStats.getSessionAttemptedKeys());

    // Subscribe to real-time performance updates
    useEffect(() => {
        const unsubscribe = performanceStats.subscribe(() => {
            setSpeedModelStats(performanceStats.getModelStats());
            setApiStats(performanceStats.getApiStats());
            setSessionExcluded(performanceStats.getSessionExcludedKeys());
            setSessionAttempted(performanceStats.getSessionAttemptedKeys());
            setTick(t => t + 1);
        });
        return () => unsubscribe();
    }, []);

    // Ensure logs are sorted
    const sortedLogs = useMemo(() => [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), [logs]);

    // 1. Daily, Weekly, Monthly total counts
    const stats = useMemo(() => {
        let daily = 0, weekly = 0, monthly = 0;
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        const startOfMonth = now.getTime() - (30 * 24 * 60 * 60 * 1000);

        sortedLogs.forEach(log => {
            const time = new Date(log.timestamp).getTime();
            if (time >= startOfDay) daily += log.itemCount;
            if (time >= startOfWeek) weekly += log.itemCount;
            if (time >= startOfMonth) monthly += log.itemCount;
        });
        return { daily, weekly, monthly };
    }, [sortedLogs, tick]);

    // 2. Custom Range Total
    const customRangeTotal = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return 0;
        const start = new Date(dateRange.start).getTime();
        const end = new Date(dateRange.end).getTime() + 24 * 60 * 60 * 1000;
        let total = 0;
        sortedLogs.forEach(log => {
            const time = new Date(log.timestamp).getTime();
            if (time >= start && time <= end) total += log.itemCount;
        });
        return total;
    }, [sortedLogs, dateRange, tick]);

    // 3. Analyzed Model Performance
    const modelPerformanceList = useMemo(() => {
        const list = models.filter(m => m.id !== 'turbo').map(m => {
            const liveStat = speedModelStats[m.id];
            const fallbackStat = propModelStats[m.id];
            
            const count = liveStat?.count || fallbackStat?.count || 0;
            const fails = liveStat?.fails || fallbackStat?.fails || 0;
            const totalTimeMs = liveStat?.totalTimeMs || fallbackStat?.totalTimeMs || 0;
            const avgTimeMs = count > 0 ? totalTimeMs / count : 0;
            const lastLatencyMs = liveStat?.lastLatencyMs || 0;
            const totalRuns = count + fails;
            const successRate = totalRuns > 0 ? (count / totalRuns) * 100 : (count > 0 ? 100 : 0);

            return {
                id: m.id,
                name: m.name.split(' (')[0],
                rawName: m.name,
                isDefault: m.id.includes('3.1-flash-lite'),
                count,
                fails,
                totalRuns,
                avgTimeMs,
                avgTimeSec: avgTimeMs > 0 ? Number((avgTimeMs / 1000).toFixed(1)) : 0,
                lastLatencySec: lastLatencyMs > 0 ? Number((lastLatencyMs / 1000).toFixed(1)) : 0,
                successRate,
                hasData: count > 0
            };
        });

        // Sort by average latency ascending (fastest model first)
        list.sort((a, b) => {
            if (a.hasData && !b.hasData) return -1;
            if (!a.hasData && b.hasData) return 1;
            if (a.hasData && b.hasData) return a.avgTimeMs - b.avgTimeMs;
            if (a.isDefault) return -1;
            if (b.isDefault) return 1;
            return 0;
        });

        return list;
    }, [models, speedModelStats, propModelStats, tick]);

    // 4. Analyzed API Performance (Local and Central keys)
    const apiPerformanceList = useMemo(() => {
        const allKeys = [
            ...localKeys.map(k => ({ ...k, apiType: 'local' as const })),
            ...centralKeys.map(k => ({ ...k, apiType: 'central' as const }))
        ];

        const dynamicMetrics = performanceStats.getDynamicApiMetrics(allKeys);

        return allKeys.map(k => {
            const stat = apiStats[k.id];
            const isExcluded = sessionExcluded.has(k.id);
            const exclusionInfo = sessionExcluded.get(k.id);
            const isAttempted = sessionAttempted.has(k.id);
            const metric = dynamicMetrics[k.id];

            const count = stat?.count || 0;
            const fails = stat?.fails || k.errorCount || 0;
            const consecutiveErrors = metric?.consecutiveErrors ?? stat?.consecutiveErrors ?? 0;
            const avgTimeMs = stat && stat.count > 0 ? stat.avgTimeMs : 0;
            const lastLatencyMs = stat?.lastLatencyMs || 0;

            let status: 'healthy' | 'untried' | 'error_excluded' = 'healthy';
            if (isExcluded && exclusionInfo?.reason === 'error_excluded') {
                status = 'error_excluded';
            } else if (!isAttempted && k.apiType === 'local') {
                status = 'untried';
            }

            return {
                id: k.id,
                label: k.label,
                apiType: k.apiType,
                count,
                fails,
                consecutiveErrors,
                avgTimeMs,
                avgTimeSec: avgTimeMs > 0 ? Number((avgTimeMs / 1000).toFixed(1)) : 0,
                lastLatencySec: lastLatencyMs > 0 ? Number((lastLatencyMs / 1000).toFixed(1)) : 0,
                status,
                speedTag: metric?.speedTag || 'normal',
                isFastest: metric?.isFastest || false,
                diffPercentVsAvg: metric?.diffPercentVsAvg || 0,
                peerAvgLatencySec: metric?.peerAvgLatencyMs ? Number((metric.peerAvgLatencyMs / 1000).toFixed(1)) : 0,
                exclusionReason: exclusionInfo?.message,
                hasData: count > 0
            };
        }).sort((a, b) => {
            // Put error excluded keys at the bottom
            if (a.status === 'error_excluded' && b.status !== 'error_excluded') return 1;
            if (a.status !== 'error_excluded' && b.status === 'error_excluded') return -1;
            // Put untried keys next for priority
            if (a.status === 'untried' && b.status !== 'untried') return -1;
            if (a.status !== 'untried' && b.status === 'untried') return 1;
            // Then fastest first
            if (a.hasData && b.hasData) return a.avgTimeMs - b.avgTimeMs;
            if (a.hasData && !b.hasData) return -1;
            if (!a.hasData && b.hasData) return 1;
            return 0;
        });
    }, [localKeys, centralKeys, apiStats, sessionExcluded, sessionAttempted, tick]);

    const fastestModel = modelPerformanceList.find(m => m.hasData) || modelPerformanceList[0];
    const fastestApi = apiPerformanceList.find(a => a.hasData && !a.status.includes('excluded'));

    const handleResetSessionPool = () => {
        performanceStats.resetSessionPool();
        setSessionExcluded(new Map());
        setSessionAttempted(new Set());
    };

    const handleClearStats = () => {
        performanceStats.clearAllStats();
        setSpeedModelStats({});
        setApiStats({});
        setSessionExcluded(new Map());
        setSessionAttempted(new Set());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                Processing & Speed Intelligence
                                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">
                                    Adaptive Speed Engine
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400">Real-time benchmark of models, APIs, and session speed routing</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Tab Selector */}
                        <div className="bg-slate-800/80 p-1 rounded-xl flex items-center gap-1 border border-white/5">
                            <button
                                type="button"
                                onClick={() => setActiveTab('speed')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    activeTab === 'speed'
                                        ? 'bg-purple-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Zap className="w-3.5 h-3.5" />
                                Speed & APIs
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('overview')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    activeTab === 'overview'
                                        ? 'bg-purple-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                Volume & Range
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('logs')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    activeTab === 'logs'
                                        ? 'bg-purple-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                Logs ({logs.length})
                            </button>
                        </div>

                        <button 
                            onClick={onClose} 
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors ml-2"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                
                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-900/50">
                    
                    {activeTab === 'speed' && (
                        <div className="space-y-6">
                            {/* Fastest Highlights Banner */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-gradient-to-br from-fuchsia-950/40 to-slate-900 p-4 rounded-xl border border-fuchsia-500/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center border border-fuchsia-500/30">
                                            <Zap className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-mono uppercase tracking-wider text-fuchsia-400 font-bold">Fastest Model (Prioritized)</span>
                                            <p className="text-base font-bold text-slate-100 mt-0.5">{fastestModel?.name || 'Gemini 3.1 Flash Lite'}</p>
                                            <span className="text-xs text-slate-400">
                                                {fastestModel?.hasData ? `${fastestModel.avgTimeSec}s average per batch` : 'Default high-speed engine (500 RPD)'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 font-mono text-xs font-bold">
                                        ⚡ Rank #1
                                    </span>
                                </div>

                                <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 p-4 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">Fastest API Worker</span>
                                            <p className="text-base font-bold text-slate-100 mt-0.5">{fastestApi?.label || 'All local keys ready'}</p>
                                            <span className="text-xs text-slate-400">
                                                {fastestApi?.hasData ? `${fastestApi.avgTimeSec}s avg · Healthy` : 'Round-robin session verification active'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {sessionExcluded.size > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleResetSessionPool}
                                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/30 transition-all flex items-center gap-1"
                                                title="Re-enable excluded keys for session"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                Reset Pool ({sessionExcluded.size})
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Section 1: AI Model Speed & Processing Times */}
                            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                                    <div className="flex items-center gap-2">
                                        <Cpu className="w-4 h-4 text-purple-400" />
                                        <h3 className="font-bold text-slate-200 text-sm">AI Model Processing Times</h3>
                                    </div>
                                    <span className="text-xs text-slate-400 font-mono">
                                        Default: <span className="text-fuchsia-400 font-bold">Gemini 3.1 Flash Lite</span>
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {modelPerformanceList.map((m, idx) => (
                                        <div 
                                            key={m.id}
                                            className={`p-3.5 rounded-xl border transition-all ${
                                                m.isDefault 
                                                    ? 'bg-purple-950/20 border-purple-500/40 shadow-sm' 
                                                    : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-semibold text-xs text-slate-200 truncate max-w-[140px]" title={m.rawName}>
                                                        {m.name}
                                                    </span>
                                                    {m.isDefault && (
                                                        <span className="text-[9px] px-1.5 py-0.2 bg-fuchsia-500/20 text-fuchsia-300 rounded font-mono font-bold">
                                                            DEFAULT
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                                    idx === 0 && m.hasData ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                                                }`}>
                                                    {m.hasData ? `#${idx + 1} (${m.avgTimeSec}s)` : 'Unrated'}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-white/5">
                                                <div>
                                                    <span className="text-slate-500 text-[10px] block">Avg Time</span>
                                                    <span className={m.avgTimeSec && m.avgTimeSec < 3 ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                                                        {m.hasData ? `${m.avgTimeSec}s` : '--'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 text-[10px] block">Success Rate</span>
                                                    <span className={m.successRate >= 95 ? 'text-emerald-400' : 'text-amber-400'}>
                                                        {m.hasData ? `${m.successRate.toFixed(0)}%` : '--'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 2: API Keys Latency & Session Health */}
                            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                                    <div className="flex items-center gap-2">
                                        <Key className="w-4 h-4 text-emerald-400" />
                                        <h3 className="font-bold text-slate-200 text-sm">API Keys Dynamic Speed & Reliability</h3>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="text-slate-400">
                                            Policy: <span className="text-emerald-400 font-medium">Prioritize faster APIs · Exclude ONLY after 5 consecutive errors · Stats persisted</span>
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {apiPerformanceList.map(api => (
                                        <div 
                                            key={api.id}
                                            className={`p-3.5 rounded-xl border transition-all ${
                                                api.status === 'error_excluded'
                                                    ? 'bg-rose-950/20 border-rose-500/30'
                                                    : api.status === 'untried'
                                                    ? 'bg-blue-950/20 border-blue-500/30'
                                                    : api.speedTag === 'fastest'
                                                    ? 'bg-emerald-950/20 border-emerald-500/40'
                                                    : 'bg-slate-950/40 border-slate-800/80'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="font-semibold text-xs text-slate-200 truncate max-w-[150px]" title={api.label}>
                                                        {api.label}
                                                    </span>
                                                    <span className="text-[9px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded uppercase font-mono">
                                                        {api.apiType}
                                                    </span>
                                                </div>

                                                {api.status === 'healthy' && (
                                                    <>
                                                        {api.speedTag === 'fastest' && (
                                                            <span className="text-[9px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                                                ⚡ Fastest
                                                            </span>
                                                        )}
                                                        {api.speedTag === 'fast' && (
                                                            <span className="text-[9px] px-2 py-0.5 rounded font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                                                                🚀 Fast
                                                            </span>
                                                        )}
                                                        {api.speedTag === 'slower' && (
                                                            <span className="text-[9px] px-2 py-0.5 rounded font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                                                🐢 Active (+{Math.max(0, api.diffPercentVsAvg)}%)
                                                            </span>
                                                        )}
                                                        {api.speedTag === 'normal' && (
                                                            <span className="text-[9px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                🟢 Active
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                                {api.status === 'untried' && (
                                                    <span className="text-[9px] px-2 py-0.5 rounded font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        🟡 Untried (Next)
                                                    </span>
                                                )}
                                                {api.status === 'error_excluded' && (
                                                    <span className="text-[9px] px-2 py-0.5 rounded font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                                        ⛔ Excluded (5 Errors Streak)
                                                    </span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 border-t border-white/5">
                                                <div>
                                                    <span className="text-slate-500 text-[10px] block">Avg Processing</span>
                                                    <span className="text-slate-200 font-bold">
                                                        {api.hasData ? `${api.avgTimeSec}s` : '--'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500 text-[10px] block">Batches / Streak</span>
                                                    <span className="text-slate-300">
                                                        {api.count} ok · {api.consecutiveErrors > 0 ? (
                                                            <span className={api.consecutiveErrors >= 5 ? "text-rose-400 font-bold" : "text-amber-400 font-medium"}>
                                                                {api.consecutiveErrors}/5 streak
                                                            </span>
                                                        ) : (
                                                            <span className="text-emerald-400/80">0 streak</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            {api.exclusionReason && (
                                                <p className="mt-2 text-[10px] text-rose-300/90 font-mono truncate bg-rose-950/40 px-2 py-1 rounded" title={api.exclusionReason}>
                                                    {api.exclusionReason}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                                    <span className="text-slate-500">
                                        Total APIs Tracked: {apiPerformanceList.length} ({sessionExcluded.size} error-excluded this session)
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleResetSessionPool}
                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold transition-colors flex items-center gap-1.5"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            Reset Session Exclusions
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleClearStats}
                                            className="px-3 py-1.5 bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 rounded-lg font-semibold transition-colors border border-rose-500/20 flex items-center gap-1.5"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Clear All Speed Benchmarks
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Top Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                    <p className="text-sm font-semibold text-slate-400">Today</p>
                                    <p className="text-3xl font-bold text-purple-400 mt-1">{stats.daily}</p>
                                    <p className="text-xs text-slate-500 mt-1">images processed</p>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                    <p className="text-sm font-semibold text-slate-400">Last 7 Days</p>
                                    <p className="text-3xl font-bold text-blue-400 mt-1">{stats.weekly}</p>
                                    <p className="text-xs text-slate-500 mt-1">images processed</p>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
                                    <p className="text-sm font-semibold text-slate-400">Last 30 Days</p>
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
                        </div>
                    )}

                    {activeTab === 'logs' && (
                        <div className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden p-4">
                            <h3 className="font-semibold text-slate-200 mb-3">Individual Processing Batches</h3>
                            {logs.length === 0 ? (
                                <p className="text-sm text-slate-500 italic text-center py-8">No processing logs available yet.</p>
                            ) : (
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    {[...logs].reverse().map((log) => (
                                        <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-sm">
                                            <div className="text-slate-400">
                                                <span className="text-slate-300">{new Date(log.timestamp).toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-slate-400"><span className="text-slate-200 font-bold">{log.itemCount}</span> items</span>
                                                <span className="font-mono text-emerald-400 font-bold">{(log.durationMs / 1000).toFixed(1)}s</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
