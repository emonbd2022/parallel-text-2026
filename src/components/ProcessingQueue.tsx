import { Cat, Maximize, Minimize, ChevronDown } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { ProcessingItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  items: ProcessingItem[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: 'title' | 'keywords' | 'category', value: string) => void;
  onRegenerate: (id: string) => void;
  onCopy: (item: ProcessingItem) => void;
  itemRefs: React.MutableRefObject<{[key: string]: HTMLDivElement | null}>;
  forceTransparency: boolean;
}

export const ProcessingQueue: React.FC<Props> = ({ items, onRemove, onUpdate, onRegenerate, onCopy, itemRefs, forceTransparency }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fieldCopied, setFieldCopied] = useState<string | null>(null);
  const [fullscreenItemId, setFullscreenItemId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (e.key === 'Escape' || (e.key.toLowerCase() === 'f' && !isInput)) {
        setFullscreenItemId(null);
      }
    };
    if (fullscreenItemId) {
      window.addEventListener('keydown', handleKeyDown);
      // Prevent body scrolling when in fullscreen
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [fullscreenItemId]);

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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6 pb-32">
      {items.map((item) => {
        const showTransparentView = forceTransparency;

        return (
          <div 
            key={item.id} 
            ref={el => { itemRefs.current[item.id] = el; }}
            className={`
              group relative flex flex-col 
              rounded-2xl overflow-hidden 
              bg-slate-900 border border-slate-800 
              transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-black/50
              ${item.status === 'processing' ? 'ring-1 ring-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]' : ''}
              ${item.status === 'error' ? 'border-red-900/50' : ''}
            `}
          >
            {/* TOP: IMAGE SECTION */}
            <div className={`
               relative w-full h-56 sm:h-64 shrink-0
               ${showTransparentView ? 'bg-transparency-grid' : 'bg-black'}
               overflow-hidden
            `}>
                {/* Floating Actions Overlay */}
                <div className="absolute top-3 right-3 z-20 flex gap-1.5">
                     <button 
                      onClick={() => handleCopyRow(item)}
                      className="px-2.5 py-1 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-bold border border-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0 shadow-md"
                    >
                      {copiedId === item.id ? 'Copied' : 'Copy Data'}
                    </button>

                    <button 
                        onClick={() => setFullscreenItemId(item.id)}
                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-md transition-colors shadow-lg border border-white/10 opacity-0 group-hover:opacity-100"
                        title="Fullscreen (F)"
                    >
                        <Maximize className="w-3.5 h-3.5" />
                    </button>

                    <button 
                        onClick={() => onRegenerate(item.id)}
                        className="p-1.5 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg backdrop-blur-md transition-colors shadow-lg"
                        title="Regenerate Metadata"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    </button>
                    
                    <button 
                        onClick={() => onRemove(item.id)}
                        className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg backdrop-blur-md transition-colors shadow-lg"
                        title="Remove"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Main Image */}
                <div className="absolute inset-0 w-full h-full">
                  {item.thumb ? (
                    <img 
                        src={item.thumb} 
                        alt={item.name} 
                        className={`w-full h-full transition-transform duration-700 group-hover:scale-105 ${showTransparentView ? 'object-contain p-3' : 'object-cover'}`}
                    />
                  ) : (
                    item.name.toLowerCase().endsWith('.eps') ? (
                       <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900">
                           <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-2 opacity-50"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6"/><path d="M12 18v-6"/></svg>
                           <span className="text-[10px] font-mono font-bold tracking-widest opacity-50">EPS FILE</span>
                       </div>
                    ) : (
                      item.status === 'error' ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-red-500 bg-slate-900">
                              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-12 pb-3 px-4 z-10 pointer-events-none">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-white font-semibold text-xs sm:text-sm truncate drop-shadow-md" title={item.name}>{item.name}</h3>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[10px] font-mono text-slate-400 bg-white/10 px-1.5 py-0.5 rounded">{(item.blob ? item.blob.size / 1024 : item.size / 1024).toFixed(0)} KB</span>
                            
                            {/* Status Pill */}
                             <div className="flex items-center gap-1.5 flex-wrap">
                               {item.status !== 'done' && item.status !== 'error' && (
                                 <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${(item.title && item.keywords && !item.category) ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                   {(item.title && item.keywords && !item.category) ? 'Phase 2: Category' : 'Phase 1: Metadata'}
                                 </span>
                               )}
                               <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                                  item.status === 'processing' ? 'text-purple-400' : 
                                  item.status === 'done' ? 'text-emerald-400' :
                                  item.status === 'error' ? 'text-red-400' :
                                  'text-slate-400'
                                }`}>
                                  {item.status === 'processing' && <Cat className="w-3.5 h-3.5 text-purple-400 animate-bounce"/>}
                                  {item.status === 'done' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>}
                                  <span>{item.status === 'processing' ? (item.progressMsg || 'Processing...') : isWaitingRetry(item) ? `Retrying (${item.attempts})...` : (item.status === 'pending' && item.title && !item.category) ? 'pending category' : item.status}</span>
                                  {item.usedModel && <span className="ml-1 text-slate-500 tracking-normal lowercase border-l border-white/10 pl-1">{item.usedModel.replace('gemini-', '')}</span>}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BOTTOM: METADATA SECTION */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-950/30 p-4 sm:p-5 space-y-4 justify-between">
                  {/* Error Banner if needed */}
                  {item.errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-300 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                         <span className="truncate">{item.errorMsg}</span>
                      </div>
                      <button onClick={() => onRegenerate(item.id)} className="text-white hover:underline font-bold shrink-0 ml-2">Retry</button>
                    </div>
                  )}

                  {/* Title Group */}
                  <div className="space-y-1.5">
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
                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-purple-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all placeholder:text-slate-700 shadow-inner"
                        placeholder={item.status === 'pending' ? 'Waiting for generation...' : (item.status === 'processing' ? (item.progressMsg || 'Processing title...') : 'Processing title...')}
                      />
                  </div>

                  {/* Keywords Group */}
                  <div className="space-y-1.5 flex-1 flex flex-col">
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
                         className="w-full flex-1 min-h-[100px] bg-slate-900/50 border border-slate-700/50 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:border-purple-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-purple-500/50 outline-none resize-none transition-all placeholder:text-slate-700 shadow-inner leading-relaxed"
                         placeholder={item.status === 'pending' ? 'Waiting for generation...' : (item.status === 'processing' ? (item.progressMsg || 'Processing keywords...') : 'Processing keywords...')}
                      />
                  </div>

                  {/* Category Group */}
                  <div className="space-y-1.5">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Category</label>
                      </div>
                      <div className="relative">
                        <select 
                          value={item.category || ""}
                          onChange={(e) => onUpdate(item.id, 'category', e.target.value)}
                          disabled={item.status === 'processing' || item.status === 'compressing'}
                          className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-3.5 py-2.5 pr-8 text-xs text-slate-200 focus:border-purple-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all shadow-inner appearance-none cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value="">Select a category...</option>
                          <option value="Animals">Animals</option>
                          <option value="Buildings and Architecture">Buildings and Architecture</option>
                          <option value="Business">Business</option>
                          <option value="Drinks">Drinks</option>
                          <option value="The Environment">The Environment</option>
                          <option value="States of Mind">States of Mind</option>
                          <option value="Food">Food</option>
                          <option value="Graphic Resources">Graphic Resources</option>
                          <option value="Hobbies and Leisure">Hobbies and Leisure</option>
                          <option value="Industry">Industry</option>
                          <option value="Landscapes">Landscapes</option>
                          <option value="Lifestyle">Lifestyle</option>
                          <option value="People">People</option>
                          <option value="Plants and Flowers">Plants and Flowers</option>
                          <option value="Culture and Religion">Culture and Religion</option>
                          <option value="Science">Science</option>
                          <option value="Social Issues">Social Issues</option>
                          <option value="Sports">Sports</option>
                          <option value="Technology">Technology</option>
                          <option value="Transport">Transport</option>
                          <option value="Travel">Travel</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                  </div>
            </div>
          </div>
        )
      })}
      
      {/* Fullscreen Image Overlay */}
      <AnimatePresence>
        {fullscreenItemId && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(12px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
            onClick={() => setFullscreenItemId(null)}
          >
            {items.find(i => i.id === fullscreenItemId)?.thumb ? (
              <motion.img 
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                src={items.find(i => i.id === fullscreenItemId)?.thumb} 
                alt="Fullscreen" 
                className={`max-w-full max-h-full object-contain drop-shadow-2xl ${forceTransparency ? 'bg-transparency-grid' : ''}`}
                onClick={(e) => e.stopPropagation()} 
              />
            ) : (
              <div className="text-slate-400">No image available</div>
            )}
            
            <button
              onClick={() => setFullscreenItemId(null)}
              className="absolute top-6 right-6 p-3 bg-black/50 hover:bg-black text-white rounded-xl backdrop-blur-md transition-all shadow-2xl border border-white/10"
              title="Exit Fullscreen (Esc or F)"
            >
              <Minimize className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
