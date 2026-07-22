import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { ApiKey, ProcessingConfig, ProcessingItem, HistoryRecord } from '../types';
import { ApiKeyManager } from './ApiKeyManager';

interface Props {
  keys: ApiKey[];
  setKeys: React.Dispatch<React.SetStateAction<ApiKey[]>>;
  config: ProcessingConfig;
  setConfig: React.Dispatch<React.SetStateAction<ProcessingConfig>>;
  isProcessing: boolean;
  onStartStop: () => void;
  hasItems: boolean;
  models: { id: string; name: string }[];
  modelStats: Record<string, { totalTimeMs: number, count: number, fails: number }>;
  history: HistoryRecord[];
  onClearHistory: () => void;
  onViewStats: () => void;
  onResetUsage: (id: string) => void;
}

export const Sidebar: React.FC<Props> = ({ 
  keys, 
  setKeys, 
  config, 
  setConfig, 
  isProcessing, 
  onStartStop, 
  hasItems,
  models,
  modelStats,
  history,
  onClearHistory,
  onViewStats,
  onResetUsage
}) => {
  
  // Custom handlers for Adobe-style sliders
  const handleBatchMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startVal = config.batchSize || 1;
    const moveHandler = (ev: MouseEvent) => {
        const delta = Math.round((ev.clientX - startX) / 40); // Slower sensitivity for small range
        setConfig(prev => ({ ...prev, batchSize: Math.min(5, Math.max(1, startVal + delta)) }));
    };
    const upHandler = () => {
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
        document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
    document.body.style.cursor = 'ew-resize';
  };

  const downloadHistoryCsv = (record: HistoryRecord) => {
    const blob = new Blob([record.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `parallel_export_${new Date(record.timestamp).getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <aside className="w-1/3 min-w-[360px] max-w-[600px] border-r border-white/5 bg-slate-900/20 flex flex-col h-full z-20">
         <div className="p-8 pb-4 shrink-0 flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 ring-1 ring-white/10">
                <Layers className="text-white w-7 h-7" />
            </div>
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight leading-none">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 via-purple-400 to-purple-400">
                    Parallel Text
                  </span>
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-1">Bulk AI Metadata Generator</p>
            </div>
         </div>
         
         <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar space-y-6">
            <ApiKeyManager 
                keys={keys}
                onAdd={(l, k) => setKeys(prev => [...prev, { 
                  id: Math.random().toString(36), 
                  label: l, 
                  key: k, 
                  errorCount: 0,
                  usage: { date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }), flash: 0, lite: 0, pro: 0, flash_3: 0, flash_3_1_lite: 0 }
                }])}
                onRemove={(id) => setKeys(prev => prev.filter(k => k.id !== id))}
                onResetUsage={onResetUsage}
            />

            <div className="glass-panel p-6 rounded-2xl space-y-6">
                <h3 className="text-lg font-bold text-slate-100 border-b border-white/5 pb-2">Configuration</h3>
                
                {/* Model Selector */}
                <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">AI Model</label>
                <div className="relative">
                    <select 
                    value={config.model}
                    onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                    className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-purple-500 outline-none"
                    >
                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                </div>
                
                {/* Performance Ratings */}
                <div className="mt-3">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                            <span className="text-[10px] uppercase font-bold text-slate-500">Model Health</span>
                            <div className="flex gap-2 text-[8px] font-mono uppercase text-slate-500" title="Color coding based on latency (<4s, <8s) and success rate (>95%, >80%)">
                                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Optimal</span>
                                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Fair</span>
                                <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Poor</span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                        {models.filter(m => m.id !== 'auto').map(m => {
                            const stat = modelStats[m.id];
                            const avgTime = stat && stat.count > 0 ? stat.totalTimeMs / stat.count : 0;
                            const totalAttempts = stat ? (stat.count + stat.fails) : 0;
                            const successRate = totalAttempts > 0 ? (stat.count / totalAttempts) * 100 : 0;
                            const isUnrated = !stat || stat.count === 0;
                            
                            return (
                                <div key={m.id} className="flex flex-col py-1">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-slate-400 truncate pr-2 font-medium" title={m.name}>{m.name.split(' (')[0]}</span>
                                        {isUnrated ? (
                                            <span className="text-slate-600 font-mono text-[9px] uppercase tracking-wider">Unrated</span>
                                        ) : (
                                            <div className="flex items-center gap-2 text-[10px] font-mono">
                                                <span className="text-slate-400" title="Average Latency">
                                                    {(avgTime/1000).toFixed(1)}s
                                                </span>
                                                <span className={successRate >= 95 ? 'text-emerald-400' : successRate >= 80 ? 'text-amber-400' : 'text-red-400'} title="Success Rate">
                                                    {successRate.toFixed(0)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {!isUnrated && (
                                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden flex items-center">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${avgTime < 4000 ? 'bg-emerald-500' : avgTime < 8000 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                style={{ width: `${Math.max(5, Math.min(100, (avgTime / 15000) * 100))}%` }}
                                                title={`Avg latency: ${(avgTime/1000).toFixed(1)}s`}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        </div>
                    </div>
                </div>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Max Title</label>
                    <input type="number" value={config.titleMaxLen} onChange={(e) => setConfig(prev => ({...prev, titleMaxLen: +e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none" />
                </div>
                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Keywords</label>
                    <input type="number" value={config.keywordsCount} onChange={(e) => setConfig(prev => ({...prev, keywordsCount: +e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none" />
                </div>
                </div>

                {/* Prefix/Suffix */}
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Prefix</label>
                    <input type="text" placeholder="Start..." value={config.titlePrefix} onChange={(e) => setConfig(prev => ({...prev, titlePrefix: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none" />
                </div>
                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Suffix</label>
                    <input type="text" placeholder="...End" value={config.titleSuffix} onChange={(e) => setConfig(prev => ({...prev, titleSuffix: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none" />
                </div>
                </div>

                {/* Negatives */}
                <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Negative Title Words</label>
                <input type="text" placeholder="word1, word2..." value={config.negativeTitleWords} onChange={(e) => setConfig(prev => ({...prev, negativeTitleWords: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none" />
                </div>
                <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Negative Keywords</label>
                <input type="text" placeholder="word1, word2..." value={config.negativeKeywords} onChange={(e) => setConfig(prev => ({...prev, negativeKeywords: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none" />
                </div>

                {/* Export Type */}
                <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Export Image Type</label>
                <div className="relative">
                    <select 
                    value={config.targetExtension}
                    onChange={(e) => setConfig(prev => ({ ...prev, targetExtension: e.target.value }))}
                    className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-purple-500 outline-none"
                    >
                    <option value="">Keep Original (Default)</option>
                    <option value=".jpg">.jpg</option>
                    <option value=".jpeg">.jpeg</option>
                    <option value=".png">.png</option>
                    <option value=".eps">.eps</option>
                    <option value=".ai">.ai</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                </div>
                </div>

                {/* Auto Export Toggle */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between group hover:border-purple-500/30 transition-colors">
                <div>
                    <span className="block text-sm font-bold text-slate-200">Auto Export</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Export CSV automatically on finish</span>
                </div>
                <button 
                    onClick={() => setConfig(prev => ({...prev, autoExport: !prev.autoExport}))}
                    className={`w-11 h-6 rounded-full transition-all relative ${config.autoExport ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-slate-700'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${config.autoExport ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                </div>

                {/* Prioritize Faster Items Toggle */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between group hover:border-purple-500/30 transition-colors">
                <div>
                    <span className="block text-sm font-bold text-slate-200">Prioritize Faster Items</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Process smaller items first</span>
                </div>
                <button 
                    onClick={() => setConfig(prev => ({...prev, prioritizeFastest: !prev.prioritizeFastest}))}
                    className={`w-11 h-6 rounded-full transition-all relative ${config.prioritizeFastest ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-slate-700'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${config.prioritizeFastest ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                </div>

                {/* Batch Size Slider (Images Per Request) */}
                <div>
                    <div className="flex justify-between items-center mb-2 pl-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Images per Request</label>
                    <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-xs font-bold px-2 py-0.5 rounded-md font-mono">
                        {config.batchSize || 1} imgs
                    </div>
                    </div>
                    
                    <div 
                    className="bg-slate-900 border border-slate-700 rounded-xl p-4 relative group cursor-ew-resize select-none touch-none hover:border-fuchsia-500/50 transition-colors"
                    onMouseDown={handleBatchMouseDown}
                    >
                    <div className="absolute top-1/2 left-4 right-4 h-1.5 bg-slate-800 rounded-full -translate-y-1/2 overflow-hidden pointer-events-none">
                        <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-75 ease-out"
                        style={{ width: `${(((config.batchSize || 1) - 1) / 4) * 100}%` }}
                        />
                    </div>
                    <div 
                        className="absolute top-1/2 w-5 h-5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] border-2 border-fuchsia-500 -translate-y-1/2 -translate-x-1/2 transition-transform duration-75 ease-out pointer-events-none group-active:scale-125"
                        style={{ left: `calc(1rem + ${(((config.batchSize || 1) - 1) / 4) * (100 - (32/300)*100)}%)` }} 
                    />
                    <div className="w-full h-4"></div>
                    <div className="flex justify-between mt-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest select-none pointer-events-none">
                        <span>1 (Safe)</span>
                        <span>5 (Efficient)</span>
                    </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 px-1 leading-relaxed">
                        Combine multiple images into one request to save API quota.
                    </p>
                </div>

                {/* Transparency Toggle */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between group hover:border-purple-500/30 transition-colors">
                <div>
                    <span className="block text-sm font-bold text-slate-200">Transparent Background</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Force "isolated on transparent background" tag</span>
                </div>
                <button 
                    onClick={() => setConfig(prev => ({...prev, forceTransparency: !prev.forceTransparency}))}
                    className={`w-11 h-6 rounded-full transition-all relative ${config.forceTransparency ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-slate-700'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${config.forceTransparency ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                </div>
            </div>
            
            {/* HISTORY SECTION */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="text-lg font-bold text-slate-100">Export History</h3>
                    <div className="flex gap-2">
                        <button onClick={onViewStats} className="text-[10px] uppercase font-bold text-purple-400 hover:text-purple-300 transition-colors">
                            Stats
                        </button>
                        <button onClick={onClearHistory} className="text-[10px] uppercase font-bold text-slate-500 hover:text-red-400 transition-colors">
                            Clear
                        </button>
                    </div>
                </div>
                
                {history.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-2">No exports yet</p>
                ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                        {history.map(rec => (
                            <div key={rec.id} onClick={() => downloadHistoryCsv(rec)} className="flex justify-between items-center p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 cursor-pointer border border-transparent hover:border-purple-500/30 group">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-slate-300">{new Date(rec.timestamp).toLocaleDateString()}</span>
                                    <span className="text-[10px] text-slate-500">{new Date(rec.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-slate-900 text-purple-400 px-1.5 py-0.5 rounded font-mono font-bold">{rec.itemCount} items</span>
                                    <svg className="w-4 h-4 text-slate-600 group-hover:text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
         </div>
    </aside>
  );
};
