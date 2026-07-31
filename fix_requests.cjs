const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
    "sessionRequestCountRef.current += (payload.length + 1);",
    "sessionRequestCountRef.current += 2;"
);

// Second occurrence is under `const startTime = Date.now();` in the else block
const elseBlockTarget = `        const startTime = Date.now();
        results = await generateMetadataBatch(`;
const elseBlockReplacement = `        const startTime = Date.now();
        sessionRequestCountRef.current += 2;
        results = await generateMetadataBatch(`;

if (!content.includes('sessionRequestCountRef.current += 2;\n        results = await generateMetadataBatch')) {
    content = content.replace(elseBlockTarget, elseBlockReplacement);
}

fs.writeFileSync('src/App.tsx', content);
