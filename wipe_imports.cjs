const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// The file is corrupted with duplicate imports on every single import line. I will manually wipe them.
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import { EyeOff, Eye, Download, ShieldAlert, ') && !lines[i].includes('lucide-react')) {
        lines[i] = lines[i].replace('import { EyeOff, Eye, Download, ShieldAlert, ', 'import { ');
    }
}
code = lines.join('\n');
fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
