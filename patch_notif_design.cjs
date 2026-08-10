const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const oldNotif = `              {showNotifications && (
                 <div className="absolute top-16 right-20 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl shadow-2xl z-[9999] overflow-hidden">
                    <div className="p-4 border-b border-slate-800/50 flex justify-between items-center bg-slate-800/30">
                       <span className="font-bold text-slate-100 tracking-wide">Notifications</span>
                       <button onClick={() => setShowNotifications(false)} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                       {notifications.length === 0 ? (
                          <div className="p-6 text-center text-sm text-slate-500 font-medium">You're all caught up!</div>
                       ) : (
                          notifications.map(n => (
                             <div key={n.id} onClick={() => handleMarkAsRead(n.id)} className={\`p-4 border-b border-slate-800/50 text-sm cursor-pointer transition-all duration-200 \${!n.read ? 'bg-blue-900/10 hover:bg-blue-900/20' : 'opacity-70 hover:bg-slate-800/50'}\`}>
                                <div className="flex items-start justify-between gap-3">
                                   <span className={\`font-medium leading-relaxed \${!n.read ? 'text-blue-100' : 'text-slate-400'}\`}>{n.message}</span>
                                   {!n.read && <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] shrink-0"></div>}
                                </div>
                             </div>
                          ))
                       )}
                    </div>
                 </div>
              )}`;

const newNotif = `              {showNotifications && (
                 <div className="absolute top-16 right-6 sm:right-20 w-80 bg-slate-900/95 backdrop-blur-xl border border-purple-500/20 rounded-xl shadow-[0_10px_40px_-10px_rgba(168,85,247,0.3)] z-[9999] overflow-hidden transform origin-top-right animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-800/80 flex justify-between items-center bg-slate-950/50">
                       <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-emerald-400 tracking-wide">Notifications</span>
                       <button onClick={() => setShowNotifications(false)} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                       {notifications.length === 0 ? (
                          <div className="p-8 flex flex-col items-center justify-center gap-2 text-center text-slate-500 font-medium">
                             <Bell className="w-8 h-8 text-slate-700 mb-1" />
                             You're all caught up!
                          </div>
                       ) : (
                          notifications.map(n => (
                             <div key={n.id} onClick={() => handleMarkAsRead(n.id)} className={\`p-4 border-b border-slate-800/50 text-sm cursor-pointer transition-all duration-200 \${!n.read ? 'bg-purple-900/10 hover:bg-purple-900/20' : 'opacity-70 hover:bg-slate-800/50'}\`}>
                                <div className="flex items-start justify-between gap-3">
                                   <span className={\`font-medium leading-relaxed \${!n.read ? 'text-slate-100' : 'text-slate-400'}\`}>{n.message}</span>
                                   {!n.read && <div className="w-2 h-2 mt-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] shrink-0"></div>}
                                </div>
                             </div>
                          ))
                       )}
                    </div>
                 </div>
              )}`;

code = code.replace(oldNotif, newNotif);
fs.writeFileSync('src/components/Layout.tsx', code);
