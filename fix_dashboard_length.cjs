const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
code = code.replace("if (validExports.length !== localExports.length) {", "if (validExports.length !== userExports.length) {");
fs.writeFileSync('src/pages/Dashboard.tsx', code);
