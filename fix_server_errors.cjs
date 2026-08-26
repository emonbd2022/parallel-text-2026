const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
`res.status(500).json({ success: false, error: "Failed to fetch central keys", keys: [] });`,
`res.status(500).json({ success: false, error: "Failed to fetch central keys", details: String(error?.message || error), stack: String(error?.stack || ''), keys: [] });`
);

content = content.replace(
`res.status(500).send(e.message);`,
`res.status(500).json({ error: String(e?.message || e), stack: String(e?.stack || '') });`
);

fs.writeFileSync('server.ts', content);
