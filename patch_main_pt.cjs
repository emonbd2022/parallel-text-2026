const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<main \n        className="flex-1 flex flex-col h-full overflow-hidden relative"`;

const replacement = `<main \n        className="flex-1 flex flex-col h-full overflow-hidden relative pt-4"`;

content = content.replace(target, replacement);

fs.writeFileSync('src/App.tsx', content);
