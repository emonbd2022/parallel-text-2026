const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `className="absolute transition-all duration-300 ease-out flex flex-col items-center justify-center -translate-x-1/2 -mt-3.5"`;
const replacement = `className="absolute transition-all duration-300 ease-out flex flex-col items-center justify-center -translate-x-1/2"`;

content = content.replace(target, replacement);

fs.writeFileSync('src/App.tsx', content);
