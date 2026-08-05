const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

// Remove the logo section from Sidebar
code = code.replace(/<div className="p-8 pb-4 shrink-0 flex items-center gap-4">[\s\S]*?<\/div>\s*<\/div>/, '');

fs.writeFileSync('src/components/Sidebar.tsx', code);
