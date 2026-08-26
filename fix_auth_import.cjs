const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

if (!code.includes("import { auth } from '../lib/firebase';")) {
    code = code.replace(
        "import { db } from '../lib/firebase';",
        "import { db, auth } from '../lib/firebase';"
    );
}
fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
