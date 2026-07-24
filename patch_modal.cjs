const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add states
const stateTarget = `const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);`;
const stateReplacement = `const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);\n  const [showExportModal, setShowExportModal] = useState(false);\n  const [exportStats, setExportStats] = useState({ count: 0, path: '' });`;
content = content.replace(stateTarget, stateReplacement);

// 2. Modify handleExport
const handleExportTarget = `        setStatusMsg("Export complete! CSV file has been downloaded. All items cleared.");
        showNotification("Export Complete", \`CSV file with \${completedItems.length} items has been downloaded.\`);
    } else {
        setStatusMsg(\`Exported partial CSV with \${completedItems.length} items.\`);
        showNotification("Partial Export", \`Downloaded CSV with \${completedItems.length} completed items.\`);
    }`;
const handleExportReplacement = `        setStatusMsg("Export complete! CSV file has been downloaded. All items cleared.");
    } else {
        setStatusMsg(\`Exported partial CSV with \${completedItems.length} items.\`);
    }
    setExportStats({ count: completedItems.length, path: \`\${items.length}.csv\` });
    setShowExportModal(true);`;
content = content.replace(handleExportTarget, handleExportReplacement);

// 3. Update Queue Header
const queueHeaderTarget = `<h2 className="text-xl font-bold text-white">Queue</h2>`;
const queueHeaderReplacement = `<h2 className="text-xl font-bold text-white flex items-center gap-2">
               Queue
               <div className="relative group flex items-center">
                 <svg className="w-4 h-4 text-slate-500 hover:text-slate-300 transition-colors cursor-help" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                 <div className="absolute hidden group-hover:block bottom-full mb-2 left-0 md:left-1/2 md:-translate-x-1/2 w-64 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-xl text-xs text-slate-300 z-50 pointer-events-none">
                   <p className="font-bold text-white mb-2 pb-1 border-b border-slate-700">Keyboard Shortcuts</p>
                   <div className="flex justify-between mb-1"><span>Save Project</span><kbd className="font-mono bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 shadow-sm">Ctrl+S</kbd></div>
                   <div className="flex justify-between mb-1"><span>Export CSV</span><kbd className="font-mono bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 shadow-sm">Ctrl+E</kbd></div>
                   <div className="flex justify-between mb-1"><span>Start / Stop</span><kbd className="font-mono bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 shadow-sm">Ctrl+Enter</kbd></div>
                   <div className="flex justify-between"><span>Clear All</span><kbd className="font-mono bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 shadow-sm">Ctrl+Bksp</kbd></div>
                 </div>
               </div>
             </h2>`;
content = content.replace(queueHeaderTarget, queueHeaderReplacement);

// 4. Fix auto scroll 10000 -> 2000
content = content.replace(/10000/g, (match, offset, str) => {
    // Only replace the ones in the scroll logic
    const context = str.substring(offset - 60, offset + 60);
    if (context.includes("lastUserScrollRef.current <")) {
        return "2000";
    }
    return match;
});

// 5. Append Modal at end of main
const modalStr = `{showExportModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 relative mx-4">
            <div className="text-emerald-400 mb-4 flex justify-center">
               <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <h3 className="text-2xl font-bold text-center text-white mb-2">Export Complete</h3>
            <p className="text-center text-slate-300 mb-6">Successfully downloaded <strong className="text-white">{exportStats.path}</strong> containing <strong className="text-emerald-400">{exportStats.count}</strong> items.</p>
            <div className="flex justify-center">
              <button onClick={() => setShowExportModal(false)} className="px-8 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all font-bold shadow-lg border border-white/5 hover:scale-105 active:scale-95">Close</button>
            </div>
          </div>
        </div>
      )}`;

content = content.replace(
    `        <div className="text-center py-4 text-xs text-slate-500 border-t border-white/5 bg-slate-950/50 backdrop-blur-md shrink-0">
           All rights reserved. Developed and maintained by Shahin Alam Emon.
        </div>`,
    `        <div className="text-center py-4 text-xs text-slate-500 border-t border-white/5 bg-slate-950/50 backdrop-blur-md shrink-0">
           All rights reserved. Developed and maintained by Shahin Alam Emon.
        </div>
        ${modalStr}`
);

fs.writeFileSync('src/App.tsx', content);
