const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const useAuthMatch = `import { useAuth } from '../contexts/AuthContext';`;

// Remove firestore imports
code = code.replace(
  `import { collection, query, where, orderBy, getDocs, Timestamp, deleteDoc, doc } from 'firebase/firestore';`,
  ``
);

code = code.replace(
  `import { db } from '../lib/firebase';`,
  ``
);

// Remove state and fetch logic
const fetchTarget = `  const [csvExports, setCsvExports] = useState<any[]>([]);
  const [loadingExports, setLoadingExports] = useState(true);

  // Load from local storage
  useEffect(() => {
      setLogs(userData?.appData?.logs || JSON.parse(localStorage.getItem('parrarel_logs_v1') || '[]'));
      setModelStats(userData?.appData?.modelStats || JSON.parse(localStorage.getItem('parrarel_stats_v1') || '{}'));
  }, [userData?.appData]);

  useEffect(() => {
    if (!userData?.uid) return;

    const fetchExports = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 7);
        
        const q = query(
          collection(db, 'csv_exports'),
          where('uid', '==', userData.uid)
        );
        const snapshot = await getDocs(q);
        const userExports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        const validExports = userExports.filter(e => {
            const date = new Date(e.createdAt);
            return date > thirtyDaysAgo;
        });
        
        validExports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCsvExports(validExports);
      } catch (err) {
        console.error("Error fetching exports:", err);
      } finally {
        setLoadingExports(false);
      }
    };
    fetchExports();
  }, [userData?.uid]);`;

const fetchReplacement = `  // Load from local storage
  useEffect(() => {
      setLogs(JSON.parse(localStorage.getItem('parrarel_logs_v1') || '[]'));
      setModelStats(JSON.parse(localStorage.getItem('parrarel_stats_v1') || '{}'));
  }, []);`;

code = code.replace(fetchTarget, fetchReplacement);

// Remove JSX for Recent CSV Exports
const jsxTarget = `        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-xl mt-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Download className="w-6 h-6 text-emerald-400" />
            Recent CSV Exports
          </h2>
          <p className="text-slate-400 text-sm mb-6">Exports are available for download for up to 7 days.</p>
          
          {loadingExports ? (
            <div className="text-center py-8 text-slate-500">Loading your exports...</div>
          ) : csvExports.length === 0 ? (
            <div className="text-center py-8 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-500">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
              No recent CSV exports found.
            </div>
          ) : (
            <div className="space-y-3">
              {csvExports.map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <FileText className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200">{exp.filename}</div>
                      <div className="text-xs text-slate-400">{new Date(exp.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDownloadCsv(exp.filename, exp.csvData)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                    title="Download CSV"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>`;

code = code.replace(jsxTarget, '');

fs.writeFileSync('src/pages/Dashboard.tsx', code);
