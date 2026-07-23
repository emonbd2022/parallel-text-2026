const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const handleCopy = \(item: ProcessingItem\) => \{[\s\S]*?const row = \`\$\{safeName\},\$\{safeTitle\},\$\{safeKeys\}\`;/g;

const replacement = `const handleCopy = (item: ProcessingItem) => {
    const safeName = \`"\${item.name.replace(/"/g, '""')}"\`;
    const safeTitle = \`"\${item.title.replace(/"/g, '""')}"\`;
    const safeKeys = \`"\${item.keywords.replace(/"/g, '""')}"\`;
    const safeCategory = \`"\${(item.category || 'Technology').replace(/"/g, '""')}"\`;
    const row = \`\${safeName},\${safeTitle},\${safeKeys},\${safeCategory}\`;`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
