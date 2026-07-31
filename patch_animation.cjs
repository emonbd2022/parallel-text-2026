const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetAnimation = `                <div className={\`w-3 h-3 rounded-full \${isProcessing ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-slate-500'}\`}></div>
                <span className="text-base font-medium text-slate-100 font-mono tracking-tight shadow-black drop-shadow-sm">{statusMsg}</span>`;

const replacementAnimation = `                {isProcessing ? (
                   <div className="relative w-6 h-6 flex items-center justify-center">
                     <svg className="w-5 h-5 text-emerald-400 animate-bounce drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" viewBox="0 0 24 24" fill="currentColor">
                       <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                     </svg>
                   </div>
                ) : (
                   <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                )}
                <span className="text-base font-medium text-slate-100 font-mono tracking-tight shadow-black drop-shadow-sm">{statusMsg}</span>`;

content = content.replace(targetAnimation, replacementAnimation);
fs.writeFileSync('src/App.tsx', content);
