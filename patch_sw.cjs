const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const oldSW = `import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });`;

const newSW = `import { registerSW } from 'virtual:pwa-register';
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true); // Automatically trigger the update
  }
});`;

code = code.replace(oldSW, newSW);
fs.writeFileSync('src/main.tsx', code);
