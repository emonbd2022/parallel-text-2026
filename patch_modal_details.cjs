const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Update setExportStats to include the requests and elapsed time
const handleExportTarget = `    setExportStats({ count: completedItems.length, path: \`\${items.length}.csv\` });
    setShowExportModal(true);`;
    
const handleExportReplacement = `    const totalRequests = Object.values(modelStats).reduce((acc, s) => acc + s.count, 0);
    
    let timeStr = '0s';
    if (startTimeMs) {
      const elapsedMs = Math.max(0, Date.now() - startTimeMs);
      const elapsedSecs = Math.floor(elapsedMs / 1000);
      const m = Math.floor(elapsedSecs / 60);
      const s = elapsedSecs % 60;
      timeStr = m > 0 ? \`\${m}m \${s}s\` : \`\${s}s\`;
    }
    
    setExportStats({ count: completedItems.length, path: \`\${items.length}.csv\`, elapsedTime: timeStr, requestCount: totalRequests });
    setShowExportModal(true);`;
content = content.replace(handleExportTarget, handleExportReplacement);

// Update modal UI
const modalRegex = /<p className="text-center text-slate-300 mb-6">Successfully downloaded <strong className="text-white">\{exportStats.path\}<\/strong> containing <strong className="text-emerald-400">\{exportStats.count\}<\/strong> items\.<\/p>/;
const modalReplacement = `<div className="flex flex-col gap-3 mb-6 bg-slate-950/50 p-4 rounded-xl border border-white/5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Total Images:</span>
                <span className="text-white font-bold">{exportStats.count}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Total API Requests:</span>
                <span className="text-emerald-400 font-bold">{exportStats.requestCount}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Total Elapsed Time:</span>
                <span className="text-purple-400 font-bold">{exportStats.elapsedTime || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">File Downloaded:</span>
                <span className="text-slate-200">{exportStats.path}</span>
              </div>
              <div className="mt-2 text-center text-xs text-slate-500">
                Check your <a href="file:///C:/Users/Public/Downloads" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Downloads folder</a> for the CSV file.
              </div>
            </div>`;
content = content.replace(modalRegex, modalReplacement);

fs.writeFileSync('src/App.tsx', content);
