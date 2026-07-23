const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/\\nexport default function App\(\) \{/, '\\nexport default function App() {');

fs.writeFileSync('src/App.tsx', content);
