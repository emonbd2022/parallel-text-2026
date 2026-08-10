const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const oldMap = `                          notifications.map(n => (
                             <div key={n.id} onClick={() => handleMarkAsRead(n.id)} className={\`p-4 border-b border-slate-800/50 text-sm cursor-pointer transition-all duration-200 \${!n.read ? 'bg-purple-900/10 hover:bg-purple-900/20' : 'opacity-70 hover:bg-slate-800/50'}\`}>
                                <div className="flex items-start justify-between gap-3">
                                   <span className={\`font-medium leading-relaxed \${!n.read ? 'text-slate-100' : 'text-slate-400'}\`}>{n.message}</span>
                                   {!n.read && <div className="w-2 h-2 mt-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] shrink-0"></div>}
                                </div>
                             </div>
                          ))`;

const newMap = `                          notifications.map(n => (
                             <div key={n.id} onClick={() => handleMarkAsRead(n.id)} className={\`p-4 border-b border-slate-800/50 text-sm cursor-pointer transition-all duration-300 \${!n.read ? 'bg-gradient-to-r from-purple-900/40 to-emerald-900/10 hover:from-purple-900/50 hover:to-emerald-900/20 shadow-[inset_3px_0_0_0_#a855f7]' : 'opacity-70 hover:bg-slate-800/50'}\`}>
                                <div className="flex items-start justify-between gap-3">
                                   <span className={\`font-medium leading-relaxed \${!n.read ? 'text-purple-50 font-semibold drop-shadow-sm tracking-wide' : 'text-slate-400'}\`}>{n.message}</span>
                                   {!n.read && <div className="w-2.5 h-2.5 mt-1 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,1)] shrink-0 animate-pulse"></div>}
                                </div>
                             </div>
                          ))`;

code = code.replace(oldMap, newMap);
fs.writeFileSync('src/components/Layout.tsx', code);
