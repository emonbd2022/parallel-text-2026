const fs = require('fs');
let code = fs.readFileSync('src/services/centralKeyService.ts', 'utf8');

code = code.replace(
  /const hash = await computeKeySha256\(userUid \? \`\$\{userUid\}:\$\{trimmedKey\}\` : trimmedKey\);/g,
  `const hash = await computeKeySha256(trimmedKey);`
);

fs.writeFileSync('src/services/centralKeyService.ts', code);
