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
  history: HistoryRecord[];
  onClearHistory: () => void;
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
  history,
  onClearHistory,
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
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
                <Layers className="text-white w-7 h-7" />
            </div>
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight leading-none">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400">
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
                    className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 outline-none"
                    >
                    {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                </div>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Max Title</label>
                    <input type="number" value={config.titleMaxLen} onChange={(e) => setConfig(prev => ({...prev, titleMaxLen: +e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Keywords</label>
                    <input type="number" value={config.keywordsCount} onChange={(e) => setConfig(prev => ({...prev, keywordsCount: +e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" />
                </div>
                </div>

                {/* Prefix/Suffix */}
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Prefix</label>
                    <input type="text" placeholder="Start..." value={config.titlePrefix} onChange={(e) => setConfig(prev => ({...prev, titlePrefix: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Suffix</label>
                    <input type="text" placeholder="...End" value={config.titleSuffix} onChange={(e) => setConfig(prev => ({...prev, titleSuffix: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" />
                </div>
                </div>

                {/* Negatives */}
                <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Negative Title Words</label>
                <input type="text" placeholder="word1, word2..." value={config.negativeTitleWords} onChange={(e) => setConfig(prev => ({...prev, negativeTitleWords: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" />
                </div>
                <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Negative Keywords</label>
                <input type="text" placeholder="word1, word2..." value={config.negativeKeywords} onChange={(e) => setConfig(prev => ({...prev, negativeKeywords: e.target.value}))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" />
                </div>

                {/* Export Type */}
                <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Export Image Type</label>
                <div className="relative">
                    <select 
                    value={config.targetExtension}
                    onChange={(e) => setConfig(prev => ({ ...prev, targetExtension: e.target.value }))}
                    className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 outline-none"
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
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between group hover:border-indigo-500/30 transition-colors">
                <div>
                    <span className="block text-sm font-bold text-slate-200">Auto Export</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Export CSV automatically on finish</span>
                </div>
                <button 
                    onClick={() => setConfig(prev => ({...prev, autoExport: !prev.autoExport}))}
                    className={`w-11 h-6 rounded-full transition-all relative ${config.autoExport ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]' : 'bg-slate-700'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${config.autoExport ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                </div>

                {/* Batch Size Slider (Images Per Request) */}
                <div>
                    <div className="flex justify-between items-center mb-2 pl-1">
                    <label className="text-[10px] uppercase font-bold text-slate-500">Images per Request</label>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-md font-mono">
                        {config.batchSize || 1} imgs
                    </div>
                    </div>
                    
                    <div 
                    className="bg-slate-900 border border-slate-700 rounded-xl p-4 relative group cursor-ew-resize select-none touch-none hover:border-emerald-500/50 transition-colors"
                    onMouseDown={handleBatchMouseDown}
                    >
                    <div className="absolute top-1/2 left-4 right-4 h-1.5 bg-slate-800 rounded-full -translate-y-1/2 overflow-hidden pointer-events-none">
                        <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-75 ease-out"
                        style={{ width: `${(((config.batchSize || 1) - 1) / 4) * 100}%` }}
                        />
                    </div>
                    <div 
                        className="absolute top-1/2 w-5 h-5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] border-2 border-emerald-500 -translate-y-1/2 -translate-x-1/2 transition-transform duration-75 ease-out pointer-events-none group-active:scale-125"
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
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between group hover:border-indigo-500/30 transition-colors">
                <div>
                    <span className="block text-sm font-bold text-slate-200">Transparent Background</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Force "isolated on transparent background" tag</span>
                </div>
                <button 
                    onClick={() => setConfig(prev => ({...prev, forceTransparency: !prev.forceTransparency}))}
                    className={`w-11 h-6 rounded-full transition-all relative ${config.forceTransparency ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]' : 'bg-slate-700'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${config.forceTransparency ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                </div>

                {/* Start/Stop Button */}
                <button
                onClick={onStartStop}
                disabled={!hasItems}
                className={`w-full py-4 rounded-xl font-bold text-base shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${
                    isProcessing 
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-orange-900/30' 
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-blue-900/30 hover:shadow-blue-900/50'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                >
                {isProcessing ? 'STOP PROCESSING' : 'START PROCESSING'}
                </button>
            </div>
            
            {/* HISTORY SECTION */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="text-lg font-bold text-slate-100">Export History</h3>
                    <button onClick={onClearHistory} className="text-[10px] uppercase font-bold text-slate-500 hover:text-red-400 transition-colors">
                        Clear
                    </button>
                </div>
                
                {history.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-2">No exports yet</p>
                ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                        {history.map(rec => (
                            <div key={rec.id} onClick={() => downloadHistoryCsv(rec)} className="flex justify-between items-center p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 cursor-pointer border border-transparent hover:border-indigo-500/30 group">
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-slate-300">{new Date(rec.timestamp).toLocaleDateString()}</span>
                                    <span className="text-[10px] text-slate-500">{new Date(rec.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-slate-900 text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold">{rec.itemCount} items</span>
                                    <svg className="w-4 h-4 text-slate-600 group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
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
