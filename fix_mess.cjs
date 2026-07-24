const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const badChunk = `               )}
             </div>
                 <span className="inline-flex items-center ml-2 border-l border-white/10 pl-2 text-slate-400" title="Last auto-saved to local storage">
                   <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                   {lastAutoSave.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                 </span>
               )}
             </p>`;

const fixedChunk = `               )}
             </div>`;

content = content.replace(badChunk, fixedChunk);
fs.writeFileSync('src/App.tsx', content);
