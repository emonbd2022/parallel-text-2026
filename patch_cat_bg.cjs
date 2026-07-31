const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `               <Cat 
                 className={\`w-6 h-6 \${isProcessing ? 'animate-bounce' : ''}\`} 
                 style={{ 
                   color: \`hsl(\${Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%)\`,
                   filter: \`drop-shadow(0 0 8px hsl(\${Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%))\`
                 }}
               />`;

const replacement = `               <div className="bg-slate-950 rounded-full p-0.5">
                 <Cat 
                   className={\`w-6 h-6 \${isProcessing ? 'animate-bounce' : ''}\`} 
                   style={{ 
                     color: \`hsl(\${Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%)\`,
                     filter: \`drop-shadow(0 0 8px hsl(\${Math.round((items.filter(i => i.status === 'done').length / items.length) * 120)}, 80%, 60%))\`,
                     fill: '#020617' // Extra mask for internal transparency
                   }}
                 />
               </div>`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
