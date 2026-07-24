const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
    'sessionRequestCountRef.current += 1;',
    'sessionRequestCountRef.current += (payload.length + 1);'
);

fs.writeFileSync('src/App.tsx', content);
