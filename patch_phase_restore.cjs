const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldCheck = `    const isMetadataPhase = true; // Category is generated with metadata now
    const pendingItems = pendingMetadataItems;`;

const newCheck = `    const isMetadataPhase = pendingMetadataItems.length > 0 || isProcessingMetadata;
    const pendingItems = isMetadataPhase ? pendingMetadataItems : pendingCategoryItems;`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('src/App.tsx', code);
