const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<span>{items.length} items ({doneCount} done)</span>`;
const replacement = `<span>Queue Progress: {doneCount} / {items.length} ({items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0}%)</span>`;

content = content.replace(target, replacement);

fs.writeFileSync('src/App.tsx', content);
