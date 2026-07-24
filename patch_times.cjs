const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `             <p className="flex items-center text-sm text-slate-500">
               {items.length} items ({doneCount} done)
               {estimatedTimeNode}
               {elapsedTimeNode}
               
               {lastAutoSave && (`;
               
const replacementStr = `             <div className="flex flex-col text-sm text-slate-500 mt-1">
               <div className="flex items-center gap-2">
                 <span>{items.length} items ({doneCount} done)</span>
                 
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
content = content.replace(targetStr, replacementStr);

const estimatedNodeRegex = /estimatedTimeNode = \(\s*<span className="inline-flex items-center ml-2 text-purple-400">\s*<svg[^>]*>.*?<\/svg>\s*Estimated Time: \{m > 0 \? `\$\{m\}m ` : ''\}\{s\}s\s*<\/span>\s*\);/s;
const newEstimatedNode = `estimatedTimeNode = (
          <span className="inline-flex items-center text-purple-400">
             <svg className="w-3.5 h-3.5 mr-1 hourglass-anim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>
             Estimated Time: {m > 0 ? \`\${m}m \` : ''}{s}s
          </span>
      );`;
content = content.replace(estimatedNodeRegex, newEstimatedNode);

const elapsedNodeRegex = /elapsedTimeNode = \(\s*<span className="inline-flex items-center ml-2 text-slate-400 border-l border-white\/10 pl-2">\s*Elapsed Time: \{m > 0 \? `\$\{m\}m ` : ''\}\{s\}s\s*<\/span>\s*\);/s;
const newElapsedNode = `elapsedTimeNode = (
          <span className="inline-flex items-center text-slate-400">
             <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
             Elapsed Time: {m > 0 ? \`\${m}m \` : ''}{s}s
          </span>
      );`;
content = content.replace(elapsedNodeRegex, newElapsedNode);

fs.writeFileSync('src/App.tsx', content);
