const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const regex = /await syncCentralKeys\(false\);/g;
const replacement = `const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            await syncCentralKeys(false, idToken);`;

content = content.replace(regex, replacement);

fs.writeFileSync('server.ts', content);
