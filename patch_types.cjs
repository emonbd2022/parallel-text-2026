const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

content = content.replace(
  /title: string;\n\s+keywords: string;\n\s+assignedKeyId\?: string;/g,
  `title: string;\n  keywords: string;\n  category?: string;\n  assignedKeyId?: string;`
);

fs.writeFileSync('src/types.ts', content);
