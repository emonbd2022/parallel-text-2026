const fs = require('fs');
let code = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');
code = code.replace('{/* Usage Badges */}', `{/* Usage Badges */}
                   <span className={\`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 \${flash_3_7_Limit ? 'bg-red-500/20 text-red-400' : 'bg-pink-500/10 text-pink-400'}\`} title="Gemini 3.7 Flash Usage">
                      🚀 3.7F: {usage.flash_3_7 || 0}
                   </span>`);
fs.writeFileSync('src/components/ApiKeyManager.tsx', code);
