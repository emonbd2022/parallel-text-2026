const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const progressSearch = `           <div 
               style={{ width: \`\${items.length ? (items.filter(i => i.status === 'done').length / items.length) * 100 : 0}%\` }}
               className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-emerald-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(168,85,247,0.5)]"
           />
           {items.length > 0 && (
             <div 
               className="absolute transition-all duration-300 ease-out flex flex-col items-center justify-center -translate-x-1/2"
               style={{ left: \`\${Math.round((items.filter(i => i.status === 'done').length / items.length) * 100)}%\` }}`;

const progressReplace = `           <div 
               style={{ 
                  width: \`\${items.length ? (
                      ((items.filter(i => i.title && i.keywords).length * 0.5) + 
                       (items.filter(i => i.category && i.status === 'done').length * 0.5)) / items.length
                  ) * 100 : 0}%\` 
               }}
               className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-emerald-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(168,85,247,0.5)]"
           />
           {items.length > 0 && (
             <div 
               className="absolute transition-all duration-300 ease-out flex flex-col items-center justify-center -translate-x-1/2"
               style={{ 
                  left: \`\${items.length ? (
                      ((items.filter(i => i.title && i.keywords).length * 0.5) + 
                       (items.filter(i => i.category && i.status === 'done').length * 0.5)) / items.length
                  ) * 100 : 0}%\` 
               }}`;

code = code.replace(progressSearch, progressReplace);
fs.writeFileSync('src/App.tsx', code);
