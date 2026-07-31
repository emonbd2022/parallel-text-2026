const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetClear = `          setIsProcessing(false);
          setItems([]);
          localStorage.removeItem(STORAGE_ITEMS);`;
const replacementClear = `          setIsProcessing(false);
          setStartTimeMs(null);
          setItems([]);
          localStorage.removeItem(STORAGE_ITEMS);`;
content = content.replace(targetClear, replacementClear);
fs.writeFileSync('src/App.tsx', content);
