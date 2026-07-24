const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /<span className="inline-flex items-center ml-2 border-l border-white\/10 pl-2">\s*<Key className="w-3\.5 h-3\.5 mr-1" \/>\s*\{activeKeysCount\}\/\{keys\.length\} Healthy\s*<\/span>/;
content = content.replace(regex, "");

fs.writeFileSync('src/App.tsx', content);
