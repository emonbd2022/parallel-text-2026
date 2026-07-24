const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

if (!content.includes('autoScroll?: boolean;')) {
    content = content.replace(
        'autoExport?: boolean;',
        'autoExport?: boolean;\n  autoScroll?: boolean;'
    );
    fs.writeFileSync('src/types.ts', content);
}
