import React, { useState, useEffect } from 'react';
import { ApiKey } from '../types';

interface Props {
  keys: ApiKey[];
  onAdd: (label: string, key: string) => void;
  onRemove: (id: string) => void;
  onResetUsage: (id: string) => void;
}

export const ApiKeyManager: React.FC<Props> = ({ keys, onAdd, onRemove, onResetUsage }) => {
  const [label, setLabel] = useState('');
  const [keyVal, setKeyVal] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());

  // Update time for cooldown countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyVal.trim()) return;
    onAdd(label || `Key ${keys.length + 1}`, keyVal.trim());
    setLabel('');
    setKeyVal('');
    setShowInput(false);
  };

  const toggleVisibility = (id: string) => {
    const next = new Set(visibleKeys);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisibleKeys(next);
  };

  return (
    <div className="glass-panel p-6 rounded-2xl">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-100">API Keys</h3>
        <button 
          onClick={() => setShowInput(!showInput)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
            showInput 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
              : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/50'
          }`}
        >
          {showInput ? 'Cancel' : '+ Add Key'}
        </button>
      </div>

      {showInput && (
        <form onSubmit={handleSubmit} className="mb-6 bg-slate-800/50 p-4 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 pl-1">Label</label>
              <input 
                type="text" 
                placeholder="My Gemini Key"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 pl-1">API Secret</label>
              <input 
                type="text" 
                placeholder="AIzaSy..."
                value={keyVal}
                onChange={(e) => setKeyVal(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none font-mono"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm py-2 rounded-lg transition-colors">
            Save Key
          </button>
        </form>
      )}

      <div className="space-y-2 max-h-52 overflow-y-auto pr-2 custom-scrollbar">
        {keys.length === 0 && !showInput && (
          <div className="text-center py-6 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
            <p className="text-sm text-slate-400">No keys configured.</p>
            <p className="text-xs text-slate-500 mt-1">Add a Gemini API key to start.</p>
          </div>
        )}
        {keys.map((k) => {
          const isCoolingDown = k.cooldownUntil && k.cooldownUntil > now;
          const remainingSecs = isCoolingDown ? Math.ceil((k.cooldownUntil! - now) / 1000) : 0;
          const isDead = k.errorCount >= 5;
          const usage = {
          date: '',
          flash_3: 0,
          flash: 0,
          lite: 0,
          flash_3_1_lite: 0,
          ...(k.usage ?? {})
        };

          const flashLimit = usage.flash >= 10000;
          const liteLimit = usage.lite >= 10000;
          const flash_3_Limit = usage.flash_3 >= 10000;
          const flash_3_1_lite_Limit = usage.flash_3_1_lite >= 10000;

          return (
            <div key={k.id} className={`flex items-center justify-between transition-colors p-3 rounded-xl border group relative
              ${isDead ? 'bg-red-900/10 border-red-500/20' : 
                isCoolingDown ? 'bg-amber-900/10 border-amber-500/20' : 
                'bg-slate-800/40 hover:bg-slate-800/60 border-white/5'}`
            }>
              <div className="flex flex-col overflow-hidden mr-3 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                   <span className={`font-semibold text-sm truncate ${isDead ? 'text-red-400' : 'text-slate-200'}`} title={k.label}>{k.label}</span>
                   
                   {/* Usage Badges */}
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${flash_3_Limit ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/10 text-cyan-400'}`} title="Gemini 3 Flash Usage">
                      🔥 3F: {usage.flash_3}
                   </span>
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${flashLimit ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/10 text-cyan-400'}`} title="Gemini 2.5 Flash Usage">
                      ⚡ 2.5F: {usage.flash}
                   </span>
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${flash_3_1_lite_Limit ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`} title="Gemini 3.1 Flash Lite Usage">
                      🚀 3.1L: {usage.flash_3_1_lite}
                   </span>
                   <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 ${liteLimit ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/10 text-amber-400'}`} title="Gemini 2.5 Flash Lite Usage">
                      💡 2.5L: {usage.lite}
                   </span>

                   {isCoolingDown && (
                     <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">
                       {remainingSecs}s
                     </span>
                   )}
                   {isDead && (
                     <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-mono font-bold">
                       FAILED
                     </span>
                   )}
                </div>
                <span className="text-[10px] text-slate-500 font-mono truncate block">
                  {visibleKeys.has(k.id) ? k.key : `${k.key.substring(0, 6)}••••••••${k.key.substring(k.key.length - 4)}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                    onClick={() => onResetUsage(k.id)}
                    className="text-slate-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                    title="Reset Usage"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                </button>
                <button 
                  onClick={() => toggleVisibility(k.id)}
                  className="text-slate-500 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                  title={visibleKeys.has(k.id) ? "Hide Key" : "Show Key"}
                >
                  {visibleKeys.has(k.id) ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
                <button 
                  onClick={() => onRemove(k.id)}
                  className="text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-900/20 transition-colors"
                  title="Remove"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
