const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const importTarget = "import { Shield, Search, RefreshCw, Calendar, Trash2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';";
const importReplace = "import { Shield, Search, RefreshCw, Calendar, Trash2, CheckCircle2, AlertTriangle, Loader2, Send } from 'lucide-react';";
code = code.replace(importTarget, importReplace);

const stateTarget = "  const [cleanModalOpen, setCleanModalOpen] = useState(false);";
const stateReplace = `  const [globalNotifModalOpen, setGlobalNotifModalOpen] = useState(false);
  const [globalNotifTitle, setGlobalNotifTitle] = useState('');
  const [globalNotifMessage, setGlobalNotifMessage] = useState('');
  const [globalNotifType, setGlobalNotifType] = useState('info');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [cleanModalOpen, setCleanModalOpen] = useState(false);`;
code = code.replace(stateTarget, stateReplace);

const funcTarget = "  const toggleMaintenance = async () => {";
const funcReplace = `  const handleSendGlobalNotification = async () => {
    if (!globalNotifMessage.trim()) return;
    setSendingNotif(true);
    try {
      const notifId = 'global_' + Date.now() + '_' + Math.random().toString(36).substring(2,9);
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        targetUid: 'all',
        type: globalNotifType,
        userName: globalNotifTitle || 'Global Notice',
        message: globalNotifMessage,
        createdAt: new Date().toISOString(),
        read: false
      });
      setGlobalNotifModalOpen(false);
      setGlobalNotifTitle('');
      setGlobalNotifMessage('');
    } catch (e) {
      console.error("Failed to send global notification:", e);
      alert("Failed to send notification.");
    } finally {
      setSendingNotif(false);
    }
  };

  const toggleMaintenance = async () => {`;
code = code.replace(funcTarget, funcReplace);

// We need to inject the button and modal. Let's find a place in the return block.
const btnTarget = `<button 
              onClick={toggleMaintenance}
              className={\`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all \${
                maintenanceMode 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }\`}
            >
              <Shield className="w-4 h-4" />
              {maintenanceMode ? 'Maintenance Mode: ON' : 'Maintenance Mode: OFF'}
            </button>`;

const btnReplace = `<button 
              onClick={() => setGlobalNotifModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/50 hover:bg-blue-600/30 rounded-xl font-bold transition-all"
            >
              <Send className="w-4 h-4" />
              Send Global Notification
            </button>
            <button 
              onClick={toggleMaintenance}
              className={\`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all \${
                maintenanceMode 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                  : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }\`}
            >
              <Shield className="w-4 h-4" />
              {maintenanceMode ? 'Maintenance Mode: ON' : 'Maintenance Mode: OFF'}
            </button>`;
code = code.replace(btnTarget, btnReplace);

const modalTarget = "{/* Clean Progress Modal */}";
const modalReplace = `{/* Global Notification Modal */}
      {globalNotifModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-400" />
              New Global Notification
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Title (Optional)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  value={globalNotifTitle}
                  onChange={e => setGlobalNotifTitle(e.target.value)}
                  placeholder="e.g. System Update"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Message</label>
                <textarea 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 min-h-[100px]"
                  value={globalNotifMessage}
                  onChange={e => setGlobalNotifMessage(e.target.value)}
                  placeholder="Type your message to all users here..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  value={globalNotifType}
                  onChange={e => setGlobalNotifType(e.target.value)}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                disabled={sendingNotif}
                onClick={() => setGlobalNotifModalOpen(false)}
                className="px-4 py-2 rounded-lg font-bold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                disabled={sendingNotif || !globalNotifMessage.trim()}
                onClick={handleSendGlobalNotification}
                className="px-6 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send to All Users'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Progress Modal */}`;
code = code.replace(modalTarget, modalReplace);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
