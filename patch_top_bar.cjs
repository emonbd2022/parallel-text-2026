const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetTopBar = `        <div className="h-1 bg-slate-900 w-full shrink-0 z-50">
           <div 
               style={{ width: \`\${items.length ? (items.filter(i => i.status === 'done').length / items.length) * 100 : 0}%\` }}
               className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(168,85,247,0.5)]"
           />
        </div>`;

const replacementTopBar = `        <div className="h-1.5 bg-slate-900 w-full shrink-0 z-50 relative flex items-center">
           <div 
               style={{ width: \`\${items.length ? (items.filter(i => i.status === 'done').length / items.length) * 100 : 0}%\` }}
               className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-600 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(168,85,247,0.5)]"
           />
           {items.length > 0 && (
             <div 
               className="absolute transition-all duration-300 ease-out flex flex-col items-center justify-center -translate-x-1/2 -mt-3.5"
               style={{ left: \`\${Math.round((items.filter(i => i.status === 'done').length / items.length) * 100)}%\` }}
             >
               <Cat 
                 className={\`w-6 h-6 \${isProcessing ? 'animate-bounce' : ''}\`} 
                 style={{ 
                   color: \`hsl(\${120 - Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%)\`,
                   filter: \`drop-shadow(0 0 5px hsl(\${120 - Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%))\`
                 }}
               />
             </div>
           )}
        </div>`;

content = content.replace(targetTopBar, replacementTopBar);

const targetBottomBar = `{items.length > 0 && (
                 <div className="w-full h-1.5 bg-slate-800 rounded-full mt-4 mb-3 relative flex items-center">
                   <div 
                     className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full transition-all duration-1000 ease-in-out" 
                     style={{ width: \`\${Math.round((doneCount / items.length) * 100)}%\` }}
                   ></div>
                   <div 
                     className="absolute transition-all duration-1000 ease-in-out flex flex-col items-center justify-center -translate-x-1/2 -mt-4"
                     style={{ left: \`\${Math.round((doneCount / items.length) * 100)}%\` }}
                   >
                     <Cat className={\`w-5 h-5 \${
                        Math.round((doneCount / items.length) * 100) < 33 ? 'text-slate-400 drop-shadow-[0_0_5px_rgba(148,163,184,0.5)]' : 
                        Math.round((doneCount / items.length) * 100) < 66 ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]' : 
                        Math.round((doneCount / items.length) * 100) < 100 ? 'text-orange-400 drop-shadow-[0_0_5px_rgba(251,146,60,0.5)]' : 
                        'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]'
                      } \${isProcessing ? 'animate-bounce' : ''}\`} />
                   </div>
                 </div>
               )}`;

content = content.replace(targetBottomBar, '');

fs.writeFileSync('src/App.tsx', content);
