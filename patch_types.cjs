const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

if (!content.includes('exportFilenameTemplate')) {
    content = content.replace(
        "targetExtension?: string; // .jpg, .png, etc.",
        "targetExtension?: string; // .jpg, .png, etc.\n  exportFilenameTemplate?: string;"
    );
    fs.writeFileSync('src/types.ts', content);
}
