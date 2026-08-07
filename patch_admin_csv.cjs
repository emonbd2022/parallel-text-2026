const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Add deleteDoc to imports
code = code.replace(
  `import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getAggregateFromServer, sum, where } from 'firebase/firestore';`,
  `import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getAggregateFromServer, sum, where, deleteDoc } from 'firebase/firestore';`
);

// Add Trash icon to lucide-react imports
code = code.replace(
  `import { Shield, Search, RefreshCw, Calendar } from 'lucide-react';`,
  `import { Shield, Search, RefreshCw, Calendar, Trash2 } from 'lucide-react';`
);

const stateSearch = `  const [showStats, setShowStats] = useState(false);`;
const stateReplace = `  const [showStats, setShowStats] = useState(false);
  const [isDeletingCsvs, setIsDeletingCsvs] = useState(false);

  const handleDeleteOldCsvs = async () => {
    if (!confirm('Are you sure you want to delete CSV exports older than 30 days?')) return;
    setIsDeletingCsvs(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const q = query(collection(db, 'csv_exports'), where('createdAt', '<', thirtyDaysAgo));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      alert(\`Deleted \${deletePromises.length} old CSV exports.\`);
    } catch (e) {
      console.error(e);
      alert('Failed to delete old CSV exports.');
    } finally {
      setIsDeletingCsvs(false);
    }
  };

  const handleDeleteAllCsvs = async () => {
    if (!confirm('WARNING: Are you sure you want to delete ALL CSV exports? This cannot be undone.')) return;
    setIsDeletingCsvs(true);
    try {
      const snapshot = await getDocs(collection(db, 'csv_exports'));
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      alert(\`Deleted all \${deletePromises.length} CSV exports.\`);
    } catch (e) {
      console.error(e);
      alert('Failed to delete all CSV exports.');
    } finally {
      setIsDeletingCsvs(false);
    }
  };`;
code = code.replace(stateSearch, stateReplace);

const uiSearch = `            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg">
              <div className="text-sm text-slate-400">Total Site Images Processed</div>
              <div className="text-2xl font-bold text-white">{totalSiteImages.toLocaleString()}</div>
            </div>`;
const uiReplace = `            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg">
              <div className="text-sm text-slate-400">Total Site Images Processed</div>
              <div className="text-2xl font-bold text-white">{totalSiteImages.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg flex flex-col gap-2">
              <div className="text-sm text-slate-400">Storage Management</div>
              <div className="flex items-center gap-2">
                 <button disabled={isDeletingCsvs} onClick={handleDeleteOldCsvs} className="px-3 py-1 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded text-xs font-bold transition-colors">
                    Delete > 30 Days
                 </button>
                 <button disabled={isDeletingCsvs} onClick={handleDeleteAllCsvs} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs font-bold transition-colors flex items-center gap-1">
                    <Trash2 className="w-3 h-3"/> All CSVs
                 </button>
              </div>
            </div>`;
code = code.replace(uiSearch, uiReplace);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
