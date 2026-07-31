const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
    "import { Clock, Key, Hourglass } from 'lucide-react';",
    "import { Clock, Key, Hourglass, Cat } from 'lucide-react';"
);

const target = `             <div className="flex flex-col text-sm text-slate-500 mt-1 gap-1">
               <div className="flex items-center gap-2">
                 <span>Queue Progress: {doneCount} / {items.length} ({items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0}%)</span>
                 
                 {isProcessing && (
                     <span className="inline-flex items-center border-l border-white/10 pl-2 text-amber-400">
                       Processing: {processingCount} items
                     </span>
                 )}
                 
               </div>
               
               <div className="flex flex-col text-[11px] font-mono mt-1 w-fit bg-slate-900/50 p-2 rounded border border-white/5 gap-1.5 min-h-[30px] justify-center">`;

const replacement = `             <div className="flex flex-col text-sm text-slate-500 mt-1 gap-1">
               <div className="flex items-center gap-2">
                 <span>Queue Progress: {doneCount} / {items.length} ({items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0}%)</span>
                 
                 {isProcessing && (
                     <span className="inline-flex items-center border-l border-white/10 pl-2 text-amber-400">
                       Processing: {processingCount} items
                     </span>
                 )}
                 
               </div>
               
               {items.length > 0 && (
                 <div className="w-full max-w-md h-2 bg-slate-800/80 rounded-full mt-3 mb-1 relative flex items-center">
                   <div 
                     className="h-full bg-gradient-to-r from-purple-600 to-fuchsia-500 rounded-full transition-all duration-500" 
                     style={{ width: \`\${Math.round((doneCount / items.length) * 100)}%\` }}
                   ></div>
                   <div 
                     className="absolute transition-all duration-500 flex flex-col items-center justify-center -translate-x-1/2 -mt-5"
                     style={{ left: \`\${Math.round((doneCount / items.length) * 100)}%\` }}
                   >
                     <Cat className={\`w-6 h-6 \${
                        Math.round((doneCount / items.length) * 100) < 33 ? 'text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]' : 
                        Math.round((doneCount / items.length) * 100) < 66 ? 'text-orange-400 drop-shadow-[0_0_5px_rgba(251,146,60,0.5)]' : 
                        Math.round((doneCount / items.length) * 100) < 100 ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]' : 
                        'text-fuchsia-400 drop-shadow-[0_0_5px_rgba(232,121,249,0.5)]'
                      } \${isProcessing ? 'animate-bounce' : ''}\`} />
                   </div>
                 </div>
               )}
               
               <div className="flex flex-col text-[11px] font-mono mt-1 w-fit bg-slate-900/50 p-2 rounded border border-white/5 gap-1.5 min-h-[30px] justify-center">`;

content = content.replace(target, replacement);

fs.writeFileSync('src/App.tsx', content);
