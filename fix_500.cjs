const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/res\.status\(500\)\.send\(e\.message\);/g, 'res.status(500).json({ success: false, error: String(e?.message || e), stack: String(e?.stack || "") });');

fs.writeFileSync('server.ts', content);
