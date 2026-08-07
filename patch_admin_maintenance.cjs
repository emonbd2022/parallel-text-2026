const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Add getDoc and setDoc imports
code = code.replace(
  `import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getAggregateFromServer, sum, where, deleteDoc } from 'firebase/firestore';`,
  `import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getAggregateFromServer, sum, where, deleteDoc, getDoc, setDoc } from 'firebase/firestore';`
);

const stateSearch = `  const [isDeletingCsvs, setIsDeletingCsvs] = useState(false);`;
const stateReplace = `  const [isDeletingCsvs, setIsDeletingCsvs] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  
  useEffect(() => {
    const fetchMaintenance = async () => {
      const docRef = doc(db, 'settings', 'general');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setMaintenanceMode(snap.data().maintenanceMode || false);
      }
    };
    fetchMaintenance();
  }, []);
  
  const toggleMaintenance = async () => {
    const newMode = !maintenanceMode;
    setMaintenanceMode(newMode);
    await setDoc(doc(db, 'settings', 'general'), { maintenanceMode: newMode }, { merge: true });
    alert(\`Maintenance mode is now \${newMode ? 'ON' : 'OFF'}\`);
  };`;
code = code.replace(stateSearch, stateReplace);

const uiSearch = `            <Shield className="w-8 h-8 text-emerald-400" />
            Admin Dashboard
          </h1>
          
          <div className="flex gap-4">`;
const uiReplace = `            <Shield className="w-8 h-8 text-emerald-400" />
            Admin Dashboard
          </h1>
          
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2 shadow-lg">
                <input type="checkbox" checked={maintenanceMode} onChange={toggleMaintenance} className="w-4 h-4 accent-red-500" />
                <span className="text-sm font-bold text-red-400">Maintenance Mode</span>
            </label>`;
code = code.replace(uiSearch, uiReplace);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
