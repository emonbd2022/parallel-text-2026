const fs = require('fs');
let code = fs.readFileSync('src/components/ProcessingQueue.tsx', 'utf8');

const pillSearch = `                            {/* Status Pill */}
                             <div className={\`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider \${
                                item.status === 'processing' ? 'text-purple-400' : 
                                item.status === 'done' ? 'text-emerald-400' :
                                item.status === 'error' ? 'text-red-400' :
                                'text-slate-400'
                              }\`}>
                                {item.status === 'processing' && <Cat className="w-4 h-4 text-purple-400 animate-bounce"/>}
                                {item.status === 'done' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>}
                                <span>{item.status === 'processing' ? (item.progressMsg || 'Processing...') : isWaitingRetry(item) ? \`Retrying (\${item.attempts})...\` : (item.status === 'pending' && item.title && !item.category) ? 'pending category' : item.status}</span>
                                {item.usedModel && <span className="ml-1 text-slate-500 tracking-normal lowercase border-l border-white/10 pl-1.5">{item.usedModel.replace('gemini-', '')}</span>}
                              </div>`;

const pillReplace = `                            {/* Status Pill */}
                             <div className="flex items-center gap-2">
                               {item.status !== 'done' && item.status !== 'error' && (
                                 <span className={\`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider \${(item.title && item.keywords && !item.category) ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-purple-500/20 text-purple-400'}\`}>
                                   {(item.title && item.keywords && !item.category) ? 'Phase 2: Category' : 'Phase 1: Metadata'}
                                 </span>
                               )}
                               <div className={\`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider \${
                                  item.status === 'processing' ? 'text-purple-400' : 
                                  item.status === 'done' ? 'text-emerald-400' :
                                  item.status === 'error' ? 'text-red-400' :
                                  'text-slate-400'
                                }\`}>
                                  {item.status === 'processing' && <Cat className="w-4 h-4 text-purple-400 animate-bounce"/>}
                                  {item.status === 'done' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>}
                                  <span>{item.status === 'processing' ? (item.progressMsg || 'Processing...') : isWaitingRetry(item) ? \`Retrying (\${item.attempts})...\` : (item.status === 'pending' && item.title && !item.category) ? 'pending category' : item.status}</span>
                                  {item.usedModel && <span className="ml-1 text-slate-500 tracking-normal lowercase border-l border-white/10 pl-1.5">{item.usedModel.replace('gemini-', '')}</span>}
                                </div>
                             </div>`;

code = code.replace(pillSearch, pillReplace);
fs.writeFileSync('src/components/ProcessingQueue.tsx', code);
