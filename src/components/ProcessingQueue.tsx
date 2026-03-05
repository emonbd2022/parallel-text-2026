import React, { useState } from 'react';
import { ProcessingItem } from '../types';

interface Props {
  items: ProcessingItem[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: 'title' | 'keywords', value: string) => void;
  onRegenerate: (id: string) => void;
  onCopy: (item: ProcessingItem) => void;
  itemRefs: React.MutableRefObject<{[key: string]: HTMLDivElement | null}>;
  forceTransparency: boolean;
}

export const ProcessingQueue: React.FC<Props> = ({ items, onRemove, onUpdate, onRegenerate, onCopy, itemRefs, forceTransparency }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fieldCopied, setFieldCopied] = useState<string | null>(null);

  const handleCopyRow = (item: ProcessingItem) => {
    onCopy(item);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyToClipboard = (text: string, id: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    const key = `${id}-${field}`;
    setFieldCopied(key);
    setTimeout(() => setFieldCopied(null), 1500);
  };

  const CopyIcon = ({ active }: { active: boolean }) => (
    active ? (
      <span className="text-emerald-400 text-[10px] font-bold uppercase animate-pulse">Copied</span>
    ) : (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40 hover:opacity-100 transition-opacity">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    )
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20 cursor-default select-none">
        <div className="p-6 bg-slate-800/50 rounded-full mb-4 ring-1 ring-white/5">
           <svg className="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
           </svg>
        </div>
        <p className="text-xl font-medium text-slate-400">Your queue is empty</p>
        <p className="text-sm mt-2 text-slate-600">Drag & drop images to start processing</p>
      </div>
    );
  }

  const isWaitingRetry = (item: ProcessingItem) => {
    return item.status === 'pending' && item.attempts > 0;
  };

  return (
    <div className="space-y-8 pb-32">
      {items.map((item) => {
        const showTransparentView = forceTransparency;

        return (
          <div 
            key={item.id} 
            ref={el => { itemRefs.current[item.id] = el; }}
            className={`
              group relative flex flex-col xl:flex-row 
              rounded-3xl overflow-hidden 
              bg-slate-900 border border-slate-800 
              transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-black/50
              ${item.status === 'processing' ? 'ring-1 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]' : ''}
              ${item.status === 'error' ? 'border-red-900/50' : ''}
            `}
          >
            {/* LEFT COLUMN: IMAGE SECTION (Full Bleed) */}
            <div className={`
               relative w-full xl:w-[40%] min-h-[350px] xl:min-h-[450px] shrink-0
               ${showTransparentView ? 'bg-transparency-grid' : 'bg-black'}
               overflow-hidden
            `}>
                {/* Floating Actions Overlay */}
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                     <button 
                      onClick={() => handleCopyRow(item)}
                      className="px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg text-xs font-bold border border-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0"
                    >
                      {copiedId === item.id ? 'Copied' : 'Copy Data'}
                    </button>

                    <button 
                        onClick={() => onRegenerate(item.id)}
                        className="p-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg backdrop-blur-md transition-colors shadow-lg"
                        title="Regenerate Metadata"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    </button>
                    
                    <button 
                        onClick={() => onRemove(item.id)}
                        className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg backdrop-blur-md transition-colors shadow-lg"
                        title="Remove"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Main Image - Absolute Inset to prevent height collapse */}
                <div className="absolute inset-0 w-full h-full">
                  {item.thumb ? (
                    <img 
                        src={item.thumb} 
                        alt={item.name} 
                        className={`w-full h-full transition-transform duration-700 group-hover:scale-105 ${showTransparentView ? 'object-contain p-4' : 'object-cover'}`}
                    />
                  ) : (
                    item.name.toLowerCase().endsWith('.eps') ? (
                       <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                           <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4 opacity-50"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="M12 18v-6"/></svg>
                           <span className="text-xs font-mono font-bold tracking-widest opacity-50">EPS FILE</span>
                       </div>
                    ) : (
                      item.status === 'error' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-red-500 bg-slate-900">
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              <span className="text-xs">Image Load Failed</span>
                          </div>
                      ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-900">
                             <div className="animate-spin rounded-full h-8 w-8 border-[3px] border-slate-700 border-t-slate-400"></div>
                          </div>
                      )
                    )
                  )}
                </div>

                {/* Bottom Gradient Overlay for Details */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-20 pb-6 px-6 z-10 pointer-events-none">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-white font-semibold text-sm truncate drop-shadow-md" title={item.name}>{item.name}</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-1.5 py-0.5 rounded">{(item.blob ? item.blob.size / 1024 : item.size / 1024).toFixed(0)} KB</span>
                            
                            {/* Status Pill */}
                             <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                                item.status === 'processing' ? 'text-indigo-400' : 
                                item.status === 'done' ? 'text-emerald-400' :
                                item.status === 'error' ? 'text-red-400' :
                                'text-slate-400'
                              }`}>
                                {item.status === 'processing' && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"/>}
                                {item.status === 'done' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>}
                                <span>{item.status === 'processing' ? 'Processing...' : isWaitingRetry(item) ? `Retrying (${item.attempts})...` : item.status}</span>
                              </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: METADATA */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-950/30">
                 {/* Metadata Content */}
                 <div className="flex-1 p-6 lg:p-8 space-y-6 flex flex-col justify-center">
                      
                      {/* Error Banner if needed */}
                      {item.errorMsg && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-xs text-red-300 flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                             <span>{item.errorMsg}</span>
                          </div>
                          <button onClick={() => onRegenerate(item.id)} className="text-white hover:underline font-bold">Retry</button>
                        </div>
                      )}

                      {/* Title Group */}
                      <div className="space-y-2">
                          <div className="flex justify-between items-end">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Title</label>
                             {item.title && (
                                <button 
                                  onClick={() => copyToClipboard(item.title, item.id, 'title')} 
                                  className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
                                >
                                    <CopyIcon active={fieldCopied === `${item.id}-title`} />
                                </button>
                             )}
                          </div>
                          <input 
                            value={item.title}
                            onChange={(e) => onUpdate(item.id, 'title', e.target.value)}
                            disabled={item.status === 'processing' || item.status === 'compressing'}
                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm text-slate-200 focus:border-indigo-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-700 shadow-inner"
                            placeholder={item.status === 'pending' ? 'Waiting for generation...' : 'Processing title...'}
                          />
                      </div>

                      {/* Keywords Group */}
                      <div className="space-y-2 flex-1 flex flex-col">
                          <div className="flex justify-between items-end">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Keywords</label>
                             {item.keywords && (
                                <button 
                                  onClick={() => copyToClipboard(item.keywords, item.id, 'keywords')} 
                                  className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
                                >
                                    <CopyIcon active={fieldCopied === `${item.id}-keywords`} />
                                </button>
                             )}
                          </div>
                          <textarea 
                             value={item.keywords}
                             onChange={(e) => onUpdate(item.id, 'keywords', e.target.value)}
                             disabled={item.status === 'processing' || item.status === 'compressing'}
                             className="w-full flex-1 min-h-[140px] bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm text-slate-200 focus:border-indigo-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500/50 outline-none resize-none transition-all placeholder:text-slate-700 shadow-inner leading-relaxed"
                             placeholder={item.status === 'pending' ? 'Waiting for generation...' : 'Processing keywords...'}
                          />
                      </div>
                 </div>
            </div>
          </div>
        )
      })}
    </div>
  );
};
