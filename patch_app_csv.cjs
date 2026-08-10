const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/await addDoc\(collection\(db, 'csv_exports'\), \{/g, "addDoc(collection(db, 'csv_exports'), {");
fs.writeFileSync('src/App.tsx', code);
