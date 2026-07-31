const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
    "const [exportStats, setExportStats] = useState({ count: 0, path: '', elapsedTime: '0s', requestCount: 0 });",
    "const [exportStats, setExportStats] = useState({ count: 0, path: '', elapsedTime: '0s', requestCount: 0, timeSaved: '0s' });"
);

const calcTarget = `    const totalRequests = sessionRequestCountRef.current;
    
    let timeStr = '0s';
    if (startTimeMs) {
      const elapsedMs = Math.max(0, Date.now() - startTimeMs);
      const elapsedSecs = Math.floor(elapsedMs / 1000);
      const m = Math.floor(elapsedSecs / 60);
      const s = elapsedSecs % 60;
      timeStr = m > 0 ? \`\${m}m \${s}s\` : \`\${s}s\`;
    }
    
    setExportStats({ count: completedItems.length, path: \`\${items.length}.csv\`, elapsedTime: timeStr, requestCount: totalRequests });`;

const calcReplacement = `    const totalRequests = sessionRequestCountRef.current;
    
    let timeStr = '0s';
    let timeSavedStr = '0s';
    const manualSecondsPerImage = 120; // Assume 2 mins per image manually
    
    if (startTimeMs) {
      const elapsedMs = Math.max(0, Date.now() - startTimeMs);
      const elapsedSecs = Math.floor(elapsedMs / 1000);
      const m = Math.floor(elapsedSecs / 60);
      const s = elapsedSecs % 60;
      timeStr = m > 0 ? \`\${m}m \${s}s\` : \`\${s}s\`;
      
      const totalManualSeconds = completedItems.length * manualSecondsPerImage;
      const savedSecs = Math.max(0, totalManualSeconds - elapsedSecs);
      
      const savedH = Math.floor(savedSecs / 3600);
      const savedM = Math.floor((savedSecs % 3600) / 60);
      const savedS = savedSecs % 60;
      
      if (savedH > 0) {
        timeSavedStr = \`\${savedH}h \${savedM}m\`;
      } else if (savedM > 0) {
        timeSavedStr = \`\${savedM}m \${savedS}s\`;
      } else {
        timeSavedStr = \`\${savedS}s\`;
      }
    } else {
      const savedSecs = completedItems.length * manualSecondsPerImage;
      const savedH = Math.floor(savedSecs / 3600);
      const savedM = Math.floor((savedSecs % 3600) / 60);
      const savedS = savedSecs % 60;
      
      if (savedH > 0) {
        timeSavedStr = \`~\${savedH}h \${savedM}m\`;
      } else if (savedM > 0) {
        timeSavedStr = \`~\${savedM}m \${savedS}s\`;
      } else {
        timeSavedStr = \`~\${savedS}s\`;
      }
    }
    
    setExportStats({ count: completedItems.length, path: \`\${items.length}.csv\`, elapsedTime: timeStr, requestCount: totalRequests, timeSaved: timeSavedStr });`;

content = content.replace(calcTarget, calcReplacement);

const jsxTarget = `              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Total Elapsed Time:</span>
                <span className="text-purple-400 font-bold">{exportStats.elapsedTime || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">File Downloaded:</span>`;

const jsxReplacement = `              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Total Elapsed Time:</span>
                <span className="text-purple-400 font-bold">{exportStats.elapsedTime || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Est. Time Saved:</span>
                <span className="text-amber-400 font-bold">{exportStats.timeSaved}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">File Downloaded:</span>`;

content = content.replace(jsxTarget, jsxReplacement);

fs.writeFileSync('src/App.tsx', content);
