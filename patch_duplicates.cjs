const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const existingNames = new Set(items.map(p => p.name));
    
    const newItems: ProcessingItem[] = Array.from(files)
      .filter(f => (f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.eps') || f.name.toLowerCase().endsWith('.svg')) && !existingNames.has(f.name))
      .map(f => ({`;

const replacement = `  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const existingNames = new Set(items.map(p => p.name));
    
    const newItems: ProcessingItem[] = [];
    for (const f of Array.from(files)) {
      if ((f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.eps') || f.name.toLowerCase().endsWith('.svg')) && !existingNames.has(f.name)) {
        existingNames.add(f.name);
        newItems.push({`;

content = content.replace(target, replacement);

const target2 = `        failedKeyIds: []
      }));`;

const replacement2 = `        failedKeyIds: []
      });
      }
    }`;

content = content.replace(target2, replacement2);
fs.writeFileSync('src/App.tsx', content);
