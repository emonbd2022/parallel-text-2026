const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `<span>{items.length} items ({doneCount} done)</span>`;
const replacementStr = `<span>{items.length} items ({doneCount} done)</span>
                 
                 {processingCount > 0 && (
                     <span className="inline-flex items-center border-l border-white/10 pl-2 text-amber-400">
                       Processing: {processingCount} items
                     </span>
                 )}`;
                 
content = content.replace(targetStr, replacementStr);
fs.writeFileSync('src/App.tsx', content);
