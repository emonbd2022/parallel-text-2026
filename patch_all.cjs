const fs = require('fs');

// 1. ApiKeyManager.tsx
let apiContent = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');

// Add Key icon import
if (!apiContent.includes("import { Key } from 'lucide-react';")) {
  apiContent = apiContent.replace(
    "import React, { useState, useEffect } from 'react';",
    "import React, { useState, useEffect } from 'react';\nimport { Key } from 'lucide-react';"
  );
}

// Fix "$keys.length"
apiContent = apiContent.replace(
  "API Keys (${keys.length})",
  "<span className=\"flex items-center gap-1.5\"><Key className=\"w-4 h-4\" /> ({keys.length})</span>"
);

// Add total lifetime in health tab
const totalTarget = `                              <div className="flex justify-between items-center mb-1 px-1 text-xs">
                                  <span className={\`font-medium truncate max-w-[120px] \${isDead ? 'text-red-400' : 'text-slate-300'}\`} title={k.label}>{k.label}</span>
                                  <div className="flex items-center gap-2">`;
const totalReplacement = `                              <div className="flex justify-between items-center mb-1 px-1 text-xs">
                                  <div className="flex flex-col">
                                    <span className={\`font-medium truncate max-w-[120px] \${isDead ? 'text-red-400' : 'text-slate-300'}\`} title={k.label}>{k.label}</span>
                                    <span className="text-[10px] text-slate-500 mt-0.5">Lifetime: {totalSuccess}</span>
                                  </div>
                                  <div className="flex items-center gap-2">`;
apiContent = apiContent.replace(totalTarget, totalReplacement);
fs.writeFileSync('src/components/ApiKeyManager.tsx', apiContent);

// 2. Sidebar.tsx
let sidebarContent = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// Add autoScroll to config usage
if (!sidebarContent.includes('autoScroll: !prev.autoScroll')) {
  const autoExportSection = `                {/* Auto Export Toggle */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between group hover:border-purple-500/30 transition-colors">
                <div>
                    <span className="block text-sm font-bold text-slate-200">Auto Export</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Export CSV automatically on finish</span>
                </div>
                <button 
                    onClick={() => setConfig(prev => ({...prev, autoExport: !prev.autoExport}))}
                    className={\`w-11 h-6 rounded-full transition-all relative \${config.autoExport ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-slate-700'}\`}
                >
                    <div className={\`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 \${config.autoExport ? 'translate-x-6' : 'translate-x-1'}\`} />
                </button>
                </div>`;
                
  const autoScrollSection = `\n                {/* Auto Scroll Toggle */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between group hover:border-purple-500/30 transition-colors">
                <div>
                    <span className="block text-sm font-bold text-slate-200">Auto-Scroll</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Scroll to processing image automatically</span>
                </div>
                <button 
                    onClick={() => setConfig(prev => ({...prev, autoScroll: config.autoScroll === false ? true : false}))}
                    className={\`w-11 h-6 rounded-full transition-all relative \${config.autoScroll !== false ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-slate-700'}\`}
                >
                    <div className={\`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 \${config.autoScroll !== false ? 'translate-x-6' : 'translate-x-1'}\`} />
                </button>
                </div>`;
                
  sidebarContent = sidebarContent.replace(autoExportSection, autoExportSection + autoScrollSection);
  fs.writeFileSync('src/components/Sidebar.tsx', sidebarContent);
}

// 3. App.tsx
let appContent = fs.readFileSync('src/App.tsx', 'utf8');

// Use config.autoScroll instead of autoScrollEnabled state
appContent = appContent.replace(
    /const \[autoScrollEnabled, setAutoScrollEnabled\] = useState\(true\);\n/g,
    ''
);

// Update auto-scroll check
appContent = appContent.replace(
    /if \(\!isProcessing \|\| \!autoScrollEnabled\) return;/g,
    "if (!isProcessing || config.autoScroll === false) return;"
);

// Remove checkbox from App.tsx Queue header
appContent = appContent.replace(
    /               <label className="flex items-center gap-1\.5 ml-4 cursor-pointer">[\s\S]*?<\/label>\n/g,
    ''
);

// Fix elapsed time display cleanly stacked
const timeHeaderTarget = `             <div className="flex flex-col text-sm text-slate-500 mt-1">
               <div className="flex items-center gap-2">
                 <span>{items.length} items ({doneCount} done)</span>
                 
                 {processingCount > 0 && (
                     <span className="inline-flex items-center border-l border-white/10 pl-2 text-amber-400">
                       Processing: {processingCount} items
                     </span>
                 )}
                 
                 {lastAutoSave && (
                   <span className="inline-flex items-center border-l border-white/10 pl-2 text-slate-400" title="Last auto-saved to local storage">
                     <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                     {lastAutoSave.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                   </span>
                 )}
               </div>
               {(estimatedTimeNode || elapsedTimeNode) && (
                 <div className="flex flex-col gap-1 mt-1 text-xs">
                   {estimatedTimeNode}
                   {elapsedTimeNode}
                 </div>
               )}
             </div>`;

const timeHeaderReplacement = `             <div className="flex flex-col text-sm text-slate-500 mt-1 gap-1">
               <div className="flex items-center gap-2">
                 <span>{items.length} items ({doneCount} done)</span>
                 
                 {processingCount > 0 && (
                     <span className="inline-flex items-center border-l border-white/10 pl-2 text-amber-400">
                       Processing: {processingCount} items
                     </span>
                 )}
                 
                 {lastAutoSave && (
                   <span className="inline-flex items-center border-l border-white/10 pl-2 text-slate-400" title="Last auto-saved to local storage">
                     <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                     {lastAutoSave.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                   </span>
                 )}
               </div>
               
               {(estimatedTimeNode || elapsedTimeNode) && (
                 <div className="flex flex-col text-[11px] font-mono mt-1 w-fit bg-slate-900/50 p-2 rounded border border-white/5 gap-1.5">
                   {estimatedTimeNode && <div className="flex items-center gap-2">{estimatedTimeNode}</div>}
                   {elapsedTimeNode && <div className="flex items-center gap-2">{elapsedTimeNode}</div>}
                 </div>
               )}
             </div>`;

appContent = appContent.replace(timeHeaderTarget, timeHeaderReplacement);

fs.writeFileSync('src/App.tsx', appContent);

