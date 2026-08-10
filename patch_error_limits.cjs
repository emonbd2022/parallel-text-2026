const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const errorMsgText = \(typeof errMsg !== 'undefined' \? errMsg : errorMessage\) \|\| "";/g;
const replacement = `const errorMsgText = (typeof error !== 'undefined' ? error.message : "") || "";`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', code);
