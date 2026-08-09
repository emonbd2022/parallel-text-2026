const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldCheck = `    const isMetadataPhase = pendingMetadataItems.length > 0 || isProcessingMetadata;
    const pendingItems = isMetadataPhase ? pendingMetadataItems : pendingCategoryItems;`;

const newCheck = `    const isMetadataPhase = true; // Category is generated with metadata now
    const pendingItems = pendingMetadataItems;`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('src/App.tsx', code);
