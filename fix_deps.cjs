const fs = require('fs');

let content = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');

content = content.replace(/const keys = sourceLocalKeys.map\(k => k.key\);/, 'const sourceLocalKeys = localKeys && localKeys.length > 0 ? localKeys : keys;\n      const apiKeys = sourceLocalKeys.map(k => k.key);');
content = content.replace(/body: JSON.stringify\(\{ localKeys: keys \}\)/, 'body: JSON.stringify({ localKeys: apiKeys })');
content = content.replace(/}, \[sourceLocalKeys\]\);/, '}, [localKeys, keys]);');

fs.writeFileSync('src/components/ApiKeyManager.tsx', content);
console.log('patched');
