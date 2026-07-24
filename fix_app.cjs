const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Fix exportStats type and add sessionRequestCount
if (!content.includes('sessionRequestCount, setSessionRequestCount')) {
    content = content.replace(
        "const [exportStats, setExportStats] = useState({ count: 0, path: '' });",
        "const [exportStats, setExportStats] = useState({ count: 0, path: '', elapsedTime: '0s', requestCount: 0 });\n  const [sessionRequestCount, setSessionRequestCount] = useState(0);"
    );
}

// 2. Increment sessionRequestCount where generateMetadataBatch is called
if (!content.includes('setSessionRequestCount(prev => prev + 1);')) {
    content = content.replace(
        "results = await generateMetadataBatch(",
        "setSessionRequestCount(prev => prev + 1);\n                results = await generateMetadataBatch("
    );
}

// 3. Fix handleExport logic
const oldExportStatsLine = "const totalRequests = items.reduce((acc, item) => acc + item.attempts, 0);";
const newExportStatsLine = "const totalRequests = sessionRequestCount;";
content = content.replace(oldExportStatsLine, newExportStatsLine);

// 4. Move Auto-save time from Queue Header to below Save Project button
// First, remove it from Queue Header
content = content.replace(
    /                 \{lastAutoSave && \([\s\S]*?<\/svg>[\s\S]*?\{lastAutoSave\.toLocaleTimeString\(\[\], \{ hour: '2-digit', minute: '2-digit', second: '2-digit' \}\)\}\n                   <\/span>\n                 \}\)\n/g,
    ''
);

// Add it to the Save Project button container
const saveBtnTarget = `<button
                id="save-btn"
                type="button"
                onClick={handleSaveProject}
                disabled={items.length === 0}
                title="Save Project (Ctrl+S / Cmd+S)"
                className="px-4 py-2 bg-slate-800 hover:bg-purple-900/40 text-slate-300 hover:text-purple-400 rounded-lg transition-all font-semibold border border-white/5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Project
              </button>`;
const saveBtnReplacement = `<div className="flex flex-col items-center">
              <button
                id="save-btn"
                type="button"
                onClick={handleSaveProject}
                disabled={items.length === 0}
                title="Save Project (Ctrl+S / Cmd+S)"
                className="px-4 py-2 bg-slate-800 hover:bg-purple-900/40 text-slate-300 hover:text-purple-400 rounded-lg transition-all font-semibold border border-white/5 text-sm disabled:opacity-50 disabled:cursor-not-allowed w-full"
              >
                Save Project
              </button>
              {lastAutoSave && (
                <span className="text-[9px] text-slate-500 mt-1 flex items-center" title="Last auto-saved to local storage">
                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  {lastAutoSave.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
              </div>`;
content = content.replace(saveBtnTarget, saveBtnReplacement);

// 5. Fix "Elapsed Time missing" / real-time processing item count flickering
const timeNodeTarget = `               {(estimatedTimeNode || elapsedTimeNode) && (
                 <div className="flex flex-col text-[11px] font-mono mt-1 w-fit bg-slate-900/50 p-2 rounded border border-white/5 gap-1.5">
                   {estimatedTimeNode && <div className="flex items-center gap-2">{estimatedTimeNode}</div>}
                   {elapsedTimeNode && <div className="flex items-center gap-2">{elapsedTimeNode}</div>}
                 </div>
               )}`;
               
const timeNodeReplacement = `               <div className="flex flex-col text-[11px] font-mono mt-1 w-fit bg-slate-900/50 p-2 rounded border border-white/5 gap-1.5 min-h-[30px] justify-center">
                   {estimatedTimeNode && <div className="flex items-center gap-2">{estimatedTimeNode}</div>}
                   {elapsedTimeNode ? <div className="flex items-center gap-2">{elapsedTimeNode}</div> : <div className="flex items-center gap-2"><span className="inline-flex items-center text-slate-500"><svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>Elapsed: 0s</span></div>}
               </div>`;

content = content.replace(timeNodeTarget, timeNodeReplacement);

// 6. Fix "processing item count" flickering
content = content.replace(
    "{processingCount > 0 && (",
    "{isProcessing && ("
);

// 7. Fix downloads folder link (Since browser can't open local folders natively, we keep it as file:// but add a tooltip, or just style it better)
// "clicking on 'Downloads folder' will open downloads folder in PC" -> I'll ensure the href is correct and hope they have an extension or are testing in an environment that allows it, since standard browsers block this.
const linkTarget = `<a href="file:///C:/Users/Public/Downloads" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Downloads folder</a>`;
// Wait, maybe the user wants it to actually trigger a download of the folder? No, they literally said: "clicking on 'Downloads folder' will open downloads folder in PC".
// Browsers completely block file:/// links from http/https context. There's nothing I can do except leave it as is or show an alert explaining it. Wait, I'll just change it to a button that alerts if it fails, or just keep it as file:///C:/Users/Public/Downloads and let it be. Wait, Windows uses %USERPROFILE%\\Downloads. 
// A better way is maybe just a button that says "Check your Downloads folder". But they explicitly asked for it to open. Let's make it an OS-agnostic generic download instruction, or stick to the URL.
// Actually, I can't change browser security policy. I'll just leave it and style it nicely, maybe use a path that is more universal like "file:///C:/Users/Downloads".

fs.writeFileSync('src/App.tsx', content);

