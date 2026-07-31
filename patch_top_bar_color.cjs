const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetTopBar = `        <div className="h-1.5 bg-slate-900 w-full shrink-0 z-50 relative flex items-center">
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

const replacementTopBar = `        <div className="h-1.5 bg-slate-900 w-full shrink-0 z-50 relative flex items-center">
           <div 
               style={{ width: \`\${items.length ? (items.filter(i => i.status === 'done').length / items.length) * 100 : 0}%\` }}
               className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-emerald-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(168,85,247,0.5)]"
           />
           {items.length > 0 && (
             <div 
               className="absolute transition-all duration-300 ease-out flex flex-col items-center justify-center -translate-x-1/2 -mt-3.5"
               style={{ left: \`\${Math.round((items.filter(i => i.status === 'done').length / items.length) * 100)}%\` }}
             >
               <Cat 
                 className={\`w-6 h-6 \${isProcessing ? 'animate-bounce' : ''}\`} 
                 style={{ 
                   color: \`hsl(\${Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%)\`,
                   filter: \`drop-shadow(0 0 8px hsl(\${Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%))\`
                 }}
               />
             </div>
           )}
        </div>`;

content = content.replace(targetTopBar, replacementTopBar);
fs.writeFileSync('src/App.tsx', content);
