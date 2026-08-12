const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(
  `import { collection, query, where, getDocs, Timestamp, deleteDoc, doc } from 'firebase/firestore';`,
  ``
);

const fetchTarget = `  const [csvExports, setCsvExports] = useState<any[]>([]);
  const [loadingExports, setLoadingExports] = useState(true);`;

code = code.replace(fetchTarget, '');

const oldEffect1 = `  // Load from local storage
  useEffect(() => {
    try {
      setLogs(userData?.appData?.logs || JSON.parse(localStorage.getItem('parrarel_logs_v1') || '[]'));
      setModelStats(userData?.appData?.modelStats || JSON.parse(localStorage.getItem('parrarel_stats_v1') || '{}'));
    } catch {}
  }, [userData?.appData]);`;

const newEffect1 = `  // Load from local storage
  useEffect(() => {
    try {
      setLogs(JSON.parse(localStorage.getItem('parrarel_logs_v1') || '[]'));
      setModelStats(JSON.parse(localStorage.getItem('parrarel_stats_v1') || '{}'));
    } catch {}
  }, []);`;

code = code.replace(oldEffect1, newEffect1);

// Just delete everything from `useEffect(() => {` with fetchExports to `fetchExports();\n  }, [userData]);`
const oldEffect2 = /  useEffect\(\(\) => \{\n    if \(\!userData\) return;\n\n    const fetchExports = async \(\) => \{[\s\S]*?fetchExports\(\);\n  \}, \[userData\?.uid\]\);/m;
code = code.replace(oldEffect2, '');

// Also remove the JSX
const jsxTarget = /<div className="bg-slate-900\/50 border border-slate-800 rounded-3xl p-8 shadow-xl mt-8">[\s\S]*?<\/div>\n      <\/div>/m;
code = code.replace(jsxTarget, '      </div>');

fs.writeFileSync('src/pages/Dashboard.tsx', code);
