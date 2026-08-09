const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

code = code.replace(/<div className="bg-slate-900\/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg flex flex-col gap-2">[\s\S]*?<\/div>\s*<\/div>/, '');

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
