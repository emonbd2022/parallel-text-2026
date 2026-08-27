const fs = require('fs');

function patchFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes("import { auth } from '../lib/firebase'")) {
        content = content.replace('import { GeminiResponse }', 'import { auth } from \'../lib/firebase\';\nimport { GeminiResponse }');
    }
    
    // Replace the fetch headers
    const newHeaders = `
       headers: { 
         'Content-Type': 'application/json',
         ...(auth?.currentUser ? { 'Authorization': \`Bearer \${await auth.currentUser.getIdToken()}\` } : {})
       },`;
       
    content = content.replace(/headers:\s*{\s*'Content-Type':\s*'application\/json'\s*},/, newHeaders);
    
    fs.writeFileSync(file, content);
    console.log(file, 'patched');
}

patchFile('src/services/geminiService.ts');
patchFile('src/services/geminiCategoryService.ts');
