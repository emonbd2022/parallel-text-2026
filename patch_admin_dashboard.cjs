const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Imports
code = code.replace(
  /import { Eye, /g,
  `import { EyeOff, Eye, `
);
if (!code.includes('EyeOff')) {
  code = code.replace(
    /import \{ /g,
    `import { EyeOff, Eye, Download, ShieldAlert, `
  );
}

// State
const stateToAdd = `
  const [centralModeEnabled, setCentralModeEnabled] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  useEffect(() => {
      fetch('/api/admin/config').then(res => res.json()).then(data => {
          if (data && data.centralModeEnabled !== undefined) setCentralModeEnabled(data.centralModeEnabled);
      }).catch(e => console.error(e));
  }, []);
  
  const handleToggleCentralMode = async () => {
      const newVal = !centralModeEnabled;
      setCentralModeEnabled(newVal);
      try {
          await fetch('/api/admin/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ centralModeEnabled: newVal })
          });
      } catch (e) { console.error(e); }
  };
  
  const handleClearAllKeys = async () => {
      if (!window.confirm("Are you sure you want to permanently delete ALL Central API keys? This cannot be undone.")) return;
      setIsActionLoading(true);
      try {
          const headers: Record<string, string> = {};
          if (auth?.currentUser) {
              headers['Authorization'] = \`Bearer \${await auth.currentUser.getIdToken()}\`;
          }
          await fetch('/api/admin/keys', { method: 'DELETE', headers });
          await fetchCentralKeys(true);
      } catch (e) { console.error(e); }
      setIsActionLoading(false);
  };
  
  const handleClearDuplicates = async () => {
      setIsActionLoading(true);
      try {
          const headers: Record<string, string> = {};
          if (auth?.currentUser) {
              headers['Authorization'] = \`Bearer \${await auth.currentUser.getIdToken()}\`;
          }
          const res = await fetch('/api/admin/keys/deduplicate', { method: 'POST', headers });
          const data = await res.json();
          if (data.success) {
              alert(\`Cleared \${data.removedCount} duplicate keys. \${data.remainingCount} unique keys remain.\`);
          }
          await fetchCentralKeys(true);
      } catch (e) { console.error(e); }
      setIsActionLoading(false);
  };
  
  const handleExportKeys = () => {
      const csvHeader = "ID,Label,MaskedKey,Contributor,Email,Status,Date Added\\n";
      const csvBody = centralKeys.map(k => \`"\${k.id}","\${k.label}","\${k.maskedKey}","\${k.contributorName}","\${k.contributorEmail || ''}","\${k.enabled ? 'Enabled' : 'Disabled'}","\${new Date(k.createdAt).toLocaleDateString()}"\`).join('\\n');
      const blob = new Blob([csvHeader + csvBody], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'central-api-keys.csv';
      a.click();
      URL.revokeObjectURL(url);
  };
  
  const toggleRevealKey = async (id: string) => {
      if (revealedKeys[id]) {
          setRevealedKeys(prev => { const n = { ...prev }; delete n[id]; return n; });
          return;
      }
      try {
          const headers: Record<string, string> = {};
          if (auth?.currentUser) {
              headers['Authorization'] = \`Bearer \${await auth.currentUser.getIdToken()}\`;
          }
          const res = await fetch(\`/api/admin/keys/\${id}/reveal\`, { headers });
          const data = await res.json();
          if (data.success && data.key) {
              setRevealedKeys(prev => ({ ...prev, [id]: data.key }));
          }
      } catch (e) { console.error(e); }
  };
`;

code = code.replace(
  /const fetchCentralKeys = async \(forceRefresh = false\) => \{/,
  stateToAdd + '\n  const fetchCentralKeys = async (forceRefresh = false) => {'
);

const uiButtonsToInject = `
                <button
                  type="button"
                  onClick={handleExportKeys}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-colors border border-slate-700 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-purple-400" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearDuplicates}
                  disabled={isActionLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-colors border border-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4 text-amber-400" />}
                  <span className="hidden sm:inline">Clear Duplicates</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearAllKeys}
                  disabled={isActionLoading}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 rounded-xl text-sm font-semibold transition-colors border border-rose-800/50 disabled:opacity-50 cursor-pointer"
                >
                  {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-rose-400" />}
                  <span className="hidden sm:inline">Clear All</span>
                </button>
`;

code = code.replace(
  /<button\s+onClick=\{\(\) => fetchCentralKeys\(true\)\}/,
  uiButtonsToInject + '\n                <button\n                  onClick={() => fetchCentralKeys(true)}'
);

const centralModeToggle = `
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-4">
               <div>
                  <h4 className="text-white font-bold">Central API Mode</h4>
                  <p className="text-slate-400 text-xs">Allow users to utilize the Central API pool when they lack keys.</p>
               </div>
               <button
                  onClick={handleToggleCentralMode}
                  className={\`w-12 h-6 rounded-full relative transition-colors \${centralModeEnabled ? 'bg-purple-600' : 'bg-slate-700'}\`}
               >
                  <div className={\`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform \${centralModeEnabled ? 'translate-x-7' : 'translate-x-1'}\`} />
               </button>
            </div>
`;

code = code.replace(
  /\{showAddKeyForm && \(/,
  centralModeToggle + '\n            {showAddKeyForm && ('
);


const revealButton = `
                                <button
                                  type="button"
                                  onClick={() => toggleRevealKey(key.id)}
                                  className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition-colors"
                                  title={revealedKeys[key.id] ? "Hide Key" : "Reveal Key"}
                                >
                                  {revealedKeys[key.id] ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
`;

code = code.replace(
  /\{key\.maskedKey \|\| '••••••••'\}/,
  `{revealedKeys[key.id] || key.maskedKey || '••••••••'}`
);

code = code.replace(
  /title="Copy Key Identifier"\s*>/,
  `title="Copy Key Identifier"
                                >`
);

code = code.replace(
  /<button\s+type="button"\s+onClick=\{\(\) => copyKeyIdentifier\(key.id, key.maskedKey \|\| key.id\)\}/,
  revealButton + '\n                                <button\n                                  type="button"\n                                  onClick={() => copyKeyIdentifier(key.id, revealedKeys[key.id] || key.maskedKey || key.id)}'
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
