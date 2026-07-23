const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const headers = \['Filename', 'Title', 'Keywords'\];\s+const rows = completedItems\.map\(i => \{[\s\S]*?return \`\$\{safeName\},\$\{safeTitle\},\$\{safeKeys\}\`;/g;

const replacement = `const headers = ['Filename', 'Title', 'Keywords', 'Category'];
    const rows = completedItems.map(i => {
      let fileName = i.name;
      if (config.targetExtension) {
        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex !== -1) {
            fileName = fileName.substring(0, lastDotIndex) + config.targetExtension;
        } else {
            fileName = fileName + config.targetExtension;
        }
      }

      const safeName = \`"\${fileName.replace(/"/g, '""')}"\`;
      const safeTitle = \`"\${i.title.replace(/"/g, '""')}"\`;
      const safeKeys = \`"\${i.keywords.replace(/"/g, '""')}"\`;
      const safeCategory = \`"\${(i.category || 'Technology').replace(/"/g, '""')}"\`;
      return \`\${safeName},\${safeTitle},\${safeKeys},\${safeCategory}\`;`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
