const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

if (!code.includes('Bell')) {
  code = code.replace(/import \{([^}]+)\} from 'lucide-react';/, (match, p1) => {
    return `import { \${p1}, Bell } from 'lucide-react';`;
  });
  fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
}
