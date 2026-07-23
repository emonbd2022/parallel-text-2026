const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const target = `<button onClick={onViewStats} className="text-[10px] uppercase font-bold text-purple-400 hover:text-purple-300 transition-colors">
                            Stats
                        </button>`;
content = content.replace(target, '');
fs.writeFileSync('src/components/Sidebar.tsx', content);
