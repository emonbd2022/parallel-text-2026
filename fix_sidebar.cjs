const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

code = code.replace(/  onResetUsage,\n  onResetAllKeys: \(id: string\) => void;\n  onResetAllKeys: \(\) => void;/g, '  onResetUsage: (id: string) => void;\n  onResetAllKeys: () => void;');
code = code.replace(/  onResetUsage: \(id: string\) => void;\n  onResetAllKeys: \(\) => void;\n  onResetAllKeys: \(\) => void;/g, '  onResetUsage: (id: string) => void;\n  onResetAllKeys: () => void;');
code = code.replace(/                onResetUsage,\n  onResetAllKeys={onResetUsage}\n                onResetAllKeys={onResetAllKeys}/g, '                onResetUsage={onResetUsage}\n                onResetAllKeys={onResetAllKeys}');

fs.writeFileSync('src/components/Sidebar.tsx', code);
