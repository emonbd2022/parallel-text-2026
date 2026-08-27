const fs = require('fs');

function addImport(file, imp) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes(imp)) {
        content = imp + '\n' + content;
        fs.writeFileSync(file, content);
        console.log(file, 'patched');
    }
}

addImport('src/components/ApiKeyManager.tsx', "import { auth } from '../lib/firebase';");
addImport('src/services/geminiCategoryService.ts', "import { auth } from '../lib/firebase';");

