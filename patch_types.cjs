const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

content = content.replace(
  /status: 'pending' \| 'compressing' \| 'processing' \| 'done' \| 'error';\n\s+errorMsg\?: string;/g,
  `status: 'pending' | 'compressing' | 'processing' | 'done' | 'error';\n  progressMsg?: string;\n  errorMsg?: string;`
);

fs.writeFileSync('src/types.ts', content);
