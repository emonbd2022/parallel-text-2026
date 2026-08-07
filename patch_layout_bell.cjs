const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const importSearch = `import { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';`;
const importReplace = `import { doc, getDoc, onSnapshot, collection, query, where, updateDoc, orderBy } from 'firebase/firestore';`;
code = code.replace(importSearch, importReplace);

const stateSearch = `  const [maintenanceMode, setMaintenanceMode] = useState(false);`;
const stateReplace = `  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  useEffect(() => {
    if (!userData) return;
    const q = query(collection(db, 'notifications'), where('targetUid', 'in', [userData.uid, userData.role === 'admin' ? 'admin' : 'none']), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
        const notifs: any[] = [];
        snapshot.forEach(d => notifs.push({ id: d.id, ...d.data() }));
        setNotifications(notifs);
    });
    return () => unsub();
  }, [userData]);
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const handleMarkAsRead = async (id: string) => {
      await updateDoc(doc(db, 'notifications', id), { read: true });
  };
`;
code = code.replace(stateSearch, stateReplace);

const userNavSearch = `        {loading ? (
        <nav className="hidden md:flex items-center gap-2">`;

const userNavReplace = `        {loading ? (
        <nav className="hidden md:flex items-center gap-2">`;

// Add bell icon to desktop nav
const desktopNavSearch = `            {userData && (
              <div className="relative ml-4 cursor-pointer group" onClick={() => navigate('/dashboard')}>`;
const desktopNavReplace = `            {userData && (
              <div className="relative flex items-center gap-4 ml-4">
                 <div className="relative cursor-pointer" onClick={() => setShowNotifications(!showNotifications)}>
                    <Bell className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{unreadCount}</span>}
                 </div>
                 {showNotifications && (
                    <div className="absolute top-full right-10 mt-4 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                       <div className="p-3 border-b border-slate-700 font-bold flex justify-between items-center">
                          Notifications
                          <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4"/></button>
                       </div>
                       <div className="max-h-64 overflow-y-auto">
                          {notifications.length === 0 ? (
                             <div className="p-4 text-center text-sm text-slate-500">No notifications</div>
                          ) : (
                             notifications.map(n => (
                                <div key={n.id} onClick={() => handleMarkAsRead(n.id)} className={\`p-3 border-b border-slate-700 text-sm cursor-pointer hover:bg-slate-700/50 transition-colors \${!n.read ? 'bg-slate-700/20' : 'opacity-60'}\`}>
                                   <div className="flex items-center justify-between gap-2">
                                      <span className={\`font-medium \${!n.read ? 'text-white' : 'text-slate-400'}\`}>{n.message}</span>
                                      {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>}
                                   </div>
                                </div>
                             ))
                          )}
                       </div>
                    </div>
                 )}
              <div className="relative cursor-pointer group" onClick={() => navigate('/dashboard')}>`;
code = code.replace(desktopNavSearch, desktopNavReplace);

fs.writeFileSync('src/components/Layout.tsx', code);
