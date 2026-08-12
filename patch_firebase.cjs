const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

const regex = /    \/\/ Enable offline persistence\n    enableMultiTabIndexedDbPersistence\(db\)\.catch\(\(err\) => \{\n      console\.warn\("Firebase persistence error:", err\.code\);\n    \}\);\n/m;

code = code.replace(regex, '');
code = code.replace(/, enableMultiTabIndexedDbPersistence/, '');

fs.writeFileSync('src/lib/firebase.ts', code);
