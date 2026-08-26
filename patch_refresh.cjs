const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /await syncCentralKeys\(true, idToken\);\s+const authHeader = req\.headers\.authorization;\s+const idToken = authHeader\?\.startsWith\('Bearer '\) \? authHeader\.split\('Bearer '\)\[1\] : undefined;/g,
  `await syncCentralKeys(true, idToken);`
);

fs.writeFileSync('server.ts', code);
