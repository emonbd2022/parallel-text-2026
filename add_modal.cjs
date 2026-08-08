const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const modalInjection = `
        {showGlobalNotif && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
                <h3 className="text-xl font-bold text-white mb-4">Send Global Notification</h3>
                <textarea 
                   className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 outline-none focus:border-purple-500 mb-4 resize-none"
                   placeholder="Enter message for ALL users..."
                   value={globalNotifMsg}
                   onChange={e => setGlobalNotifMsg(e.target.value)}
                />
                <div className="flex gap-3 justify-end">
                   <button onClick={() => setShowGlobalNotif(false)} disabled={isSendingGlobal} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">Cancel</button>
                   <button onClick={handleSendGlobalNotification} disabled={isSendingGlobal || !globalNotifMsg.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 font-bold flex items-center gap-2">
                      {isSendingGlobal ? 'Sending...' : 'Send to All Users'}
                   </button>
                </div>
             </div>
          </div>
        )}
`;

code = code.replace("    </motion.div>\n    </>\n  );\n};", modalInjection + "\n    </motion.div>\n    </>\n  );\n};");

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
