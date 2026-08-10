const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

code = code.replace("registerSW({ immediate: true });", "const updateSW = registerSW({ immediate: true, onNeedRefresh() { updateSW(true); } });");
fs.writeFileSync('src/main.tsx', code);
