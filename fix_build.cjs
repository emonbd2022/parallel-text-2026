const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Use regex to strip ANY 'EyeOff, ', 'Eye, ', 'Download, ', 'ShieldAlert, ' from ANY import EXCEPT the lucide-react one.
const toStrip = ['EyeOff, ', 'Eye, ', 'Download, ', 'ShieldAlert, '];

const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import') && !lines[i].includes('lucide-react')) {
        for (const token of toStrip) {
            lines[i] = lines[i].replace(token, '');
        }
    }
}
code = lines.join('\n');

// Also fix auth import properly
if (!code.includes("import { auth }")) {
   code = code.replace("import { db } from '../lib/firebase';", "import { db, auth } from '../lib/firebase';");
}
fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
