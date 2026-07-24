const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix handleAddFiles to initialize startTimeMs
const targetAddFiles = `    setIsProcessing(true); // Auto-start
    
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;`;
const replacementAddFiles = `    setIsProcessing(true); // Auto-start
    setStartTimeMs(prev => prev || Date.now()); // Ensure start time is initialized
    
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;`;
content = content.replace(targetAddFiles, replacementAddFiles);

// Add Ctrl+O to Keyboard shortcuts tooltip
const shortcutTarget = `<div className="flex justify-between mb-1"><span>Save Project</span>`;
const shortcutReplacement = `<div className="flex justify-between mb-1"><span>Upload</span><kbd className="font-mono bg-slate-950 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] text-slate-300 shadow-sm">Ctrl+O</kbd></div>
                   <div className="flex justify-between mb-1"><span>Save Project</span>`;
content = content.replace(shortcutTarget, shortcutReplacement);

// Add Ctrl+O to event listener
const listenerTarget = `      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {`;
const listenerReplacement = `      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        document.getElementById('fileInput')?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {`;
content = content.replace(listenerTarget, listenerReplacement);

// Fix downloads folder button in modal
const downloadTarget = `<div className="mt-2 text-center text-xs text-slate-500">
                Check your <a href="file:///" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline font-bold" onClick={(e) => { e.preventDefault(); window.open('file:///C:/', '_blank') || alert('Browser blocked opening local folder directly. Please open Downloads manually.'); }}>Downloads folder</a> for the CSV file.
              </div>`;
const downloadReplacement = `<div className="mt-4 flex justify-center">
                <button 
                  onClick={() => {
                    alert('Check your Downloads folder for the CSV file. Depending on your browser, it has been saved to your default download location.');
                  }}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-semibold text-slate-300 transition-colors flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Where is my file?
                </button>
              </div>`;
content = content.replace(downloadTarget, downloadReplacement);

fs.writeFileSync('src/App.tsx', content);
