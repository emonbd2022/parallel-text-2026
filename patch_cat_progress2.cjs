const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

if (!content.includes('import { Clock, Key, Hourglass, Cat }')) {
    content = content.replace(
        "import { Clock, Key, Hourglass } from 'lucide-react';",
        "import { Clock, Key, Hourglass, Cat } from 'lucide-react';"
    );
}

const target = /                 }\)\}\s*<\/div>\s*<div className="flex flex-col text-\[11px\]/m;

const replacement = `                 )}
               </div>
               
               {items.length > 0 && (
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
               )}
               
               <div className="flex flex-col text-[11px]`;

content = content.replace(target, replacement);

fs.writeFileSync('src/App.tsx', content);
