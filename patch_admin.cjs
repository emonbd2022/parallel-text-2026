const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Add imports
code = code.replace("import { Shield, Search, RefreshCw, Calendar, Trash2, Activity } from 'lucide-react';", "import { Shield, Search, RefreshCw, Calendar, Trash2, Activity, MessageSquare, AlertTriangle } from 'lucide-react';");

// Add new states
const newStates = `
  const [confirmAction, setConfirmAction] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);
  const [notifModal, setNotifModal] = useState<{isOpen: boolean, targetUid?: string, targetName?: string, message: string}>({isOpen: false, message: ''});
`;
code = code.replace("  const [isSendingGlobal, setIsSendingGlobal] = useState(false);", "  const [isSendingGlobal, setIsSendingGlobal] = useState(false);" + newStates);

// Replace handleDeleteOldCsvs
const oldHandleDeleteOld = `  const handleDeleteOldCsvs = async () => {
    if (!confirm('Are you sure you want to delete CSV exports older than 30 days?')) return;
    setIsDeletingCsvs(true);`;
const newHandleDeleteOld = `  const handleDeleteOldCsvs = () => {
    setConfirmAction({
      title: 'Delete Old CSVs',
      message: 'Are you sure you want to delete CSV exports older than 30 days?',
      onConfirm: async () => {
        setIsDeletingCsvs(true);`;
code = code.replace(oldHandleDeleteOld, newHandleDeleteOld);

// Add missing closing braces for handleDeleteOldCsvs
code = code.replace(/alert\(\`Deleted \$\{deletePromises\.length\} old CSV exports\.\`\);\n    \} catch \(e\) \{\n      console\.error\(e\);\n      alert\('Failed to delete old CSV exports\.'\);\n    \} finally \{\n      setIsDeletingCsvs\(false\);\n    \}\n  \};/, 
`setConfirmAction(null);
      } catch (e) {
        console.error(e);
      } finally {
        setIsDeletingCsvs(false);
      }
    }});
  };`);


// Replace handleDeleteAllCsvs
const oldHandleDeleteAll = `  const handleDeleteAllCsvs = async () => {
    if (!confirm('WARNING: Are you sure you want to delete ALL CSV exports? This cannot be undone.')) return;
    setIsDeletingCsvs(true);`;
const newHandleDeleteAll = `  const handleDeleteAllCsvs = () => {
    setConfirmAction({
      title: 'Delete All CSVs',
      message: 'WARNING: Are you sure you want to delete ALL CSV exports? This cannot be undone.',
      onConfirm: async () => {
        setIsDeletingCsvs(true);`;
code = code.replace(oldHandleDeleteAll, newHandleDeleteAll);

// Add missing closing braces for handleDeleteAllCsvs
code = code.replace(/alert\(\`Deleted all \$\{deletePromises\.length\} CSV exports\.\`\);\n    \} catch \(e\) \{\n      console\.error\(e\);\n      alert\('Failed to delete all CSV exports\.'\);\n    \} finally \{\n      setIsDeletingCsvs\(false\);\n    \}\n  \};/,
`setConfirmAction(null);
      } catch (e) {
        console.error(e);
      } finally {
        setIsDeletingCsvs(false);
      }
    }});
  };`);


// Update handleSendGlobalNotification and handleSendNotification
const oldNotifGlobal = `  const handleSendGlobalNotification = async () => {
      if (!globalNotifMsg.trim()) return;
      setIsSendingGlobal(true);`;
const newNotifGlobal = `  const handleSendNotificationAction = async () => {
      if (!notifModal.message.trim()) return;
      setIsSendingGlobal(true);`;
code = code.replace(oldNotifGlobal, newNotifGlobal);

code = code.replace(/          for \(const docSnap of allUsersSnap\.docs\) \{/, 
`          if (notifModal.targetUid) {
              await addDoc(collection(db, 'notifications'), {
                  targetUid: notifModal.targetUid,
                  type: 'admin_msg',
                  message: notifModal.message,
                  read: false,
                  createdAt: serverTimestamp()
              });
          } else {
            for (const docSnap of allUsersSnap.docs) {`);
code = code.replace(/              count\+\+;\n          \}/, `              count++;\n          }\n          }`);
code = code.replace(/          alert\(\`Sent to \$\{count\} users\`\);\n          setShowGlobalNotif\(false\);\n          setGlobalNotifMsg\(""\);/, `          setNotifModal({isOpen: false, message: ''});`);
code = code.replace(/alert\("Failed to send global notification"\);/, "");

code = code.replace(/const handleSendNotification = async \(uid: string\) => \{[\s\S]*?\}\s*\};/, "");

// Update button Send Global Message
code = code.replace("onClick={() => setShowGlobalNotif(true)}", "onClick={() => setNotifModal({isOpen: true, message: ''})}");

// Update Actions column
const oldActionsCol = `<td className="py-4 text-right">
                            <button onClick={() => handleResetCredits(user.uid)} className="p-1.5 bg-orange-500/10 text-orange-400 rounded hover:bg-orange-500/20 transition-colors" title="Reset Credits & Plan">
                               <RefreshCw className="w-4 h-4" />
                            </button>
                        </td>`;
const newActionsCol = `<td className="py-4">
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={() => setSelectedUserForActivity(user)} className="p-1.5 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors" title="View User Analytics">
                                 <Activity className="w-4 h-4" />
                              </button>
                              <button onClick={() => setNotifModal({isOpen: true, targetUid: user.uid, targetName: user.name, message: ''})} className="p-1.5 bg-purple-500/10 text-purple-400 rounded hover:bg-purple-500/20 transition-colors" title="Send Notification">
                                 <MessageSquare className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleResetCredits(user.uid)} className="p-1.5 bg-orange-500/10 text-orange-400 rounded hover:bg-orange-500/20 transition-colors" title="Reset Credits & Plan">
                                 <RefreshCw className="w-4 h-4" />
                              </button>
                            </div>
                        </td>`;
code = code.replace(oldActionsCol, newActionsCol);

// Update old global notification modal to generic notification modal
const oldModal = /\{showGlobalNotif && \([\s\S]*?\)\}/;
const newModal = `        {notifModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
                <h3 className="text-xl font-bold text-white mb-4">Send Notification {notifModal.targetName ? \`to \${notifModal.targetName}\` : 'to All Users'}</h3>
                <textarea 
                   className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 outline-none focus:border-purple-500 mb-4 resize-none"
                   placeholder="Enter message..."
                   value={notifModal.message}
                   onChange={e => setNotifModal(prev => ({...prev, message: e.target.value}))}
                />
                <div className="flex gap-3 justify-end">
                   <button onClick={() => setNotifModal({isOpen: false, message: ''})} disabled={isSendingGlobal} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">Cancel</button>
                   <button onClick={handleSendNotificationAction} disabled={isSendingGlobal || !notifModal.message.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 font-bold flex items-center gap-2">
                      {isSendingGlobal ? 'Sending...' : 'Send'}
                   </button>
                </div>
             </div>
          </div>
        )}`;

code = code.replace(oldModal, newModal);

const confirmModal = `
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <h3 className="text-xl font-bold text-white">{confirmAction.title}</h3>
                </div>
                <p className="text-slate-300 mb-6">{confirmAction.message}</p>
                <div className="flex gap-3 justify-end">
                   <button onClick={() => setConfirmAction(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">Cancel</button>
                   <button onClick={confirmAction.onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 font-bold">
                      Confirm
                   </button>
                </div>
             </div>
          </div>
        )}
`;

code = code.replace("      </div>\n    </div>\n  );\n};", confirmModal + "\n      </div>\n    </div>\n  );\n};");

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
