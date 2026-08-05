const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf-8');

code = code.replace(
  "className=\"flex items-center gap-3 hover:opacity-80 transition-opacity outline-none animate-float group\"",
  "className=\"flex items-center gap-3 hover:opacity-80 transition-opacity outline-none group\""
);

fs.writeFileSync('src/components/Layout.tsx', code);
