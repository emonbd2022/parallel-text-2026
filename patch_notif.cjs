const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const injection = `
  const handleSendGlobalNotification = async () => {
      if (!globalNotifMsg.trim()) return;
      setIsSendingGlobal(true);
      try {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          let count = 0;
          for (const docSnap of allUsersSnap.docs) {
              await addDoc(collection(db, 'notifications'), {
                  targetUid: docSnap.id,
                  type: 'admin_msg',
                  message: globalNotifMsg,
                  read: false,
                  createdAt: serverTimestamp()
              });
              count++;
          }
          alert(\`Sent to \${count} users\`);
          setShowGlobalNotif(false);
          setGlobalNotifMsg("");
      } catch (e) {
          console.error(e);
          alert("Failed to send global notification");
      } finally {
          setIsSendingGlobal(false);
      }
  };

`;

code = code.replace("const handleSendNotification = async (uid: string) => {", injection + "const handleSendNotification = async (uid: string) => {");

const buttonInjection = `
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg flex flex-col gap-2">
              <div className="text-sm text-slate-400">Notifications</div>
              <button onClick={() => setShowGlobalNotif(true)} className="px-3 py-1 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded text-xs font-bold transition-colors">
                 Send Global Message
              </button>
            </div>
`;

code = code.replace('<div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg">', buttonInjection + '\n            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg">');

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

// Insert modal at the end before final closing div
code = code.replace("      </div>\n    </div>\n  );\n};", "      </div>\n" + modalInjection + "\n    </div>\n  );\n};");

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
