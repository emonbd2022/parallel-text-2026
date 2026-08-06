const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const refSearch = `const startScrollTopRef = useRef(0);`;
const refReplace = `const startScrollTopRef = useRef(0);\n  const lastPhaseRef = useRef<'metadata' | 'category' | null>(null);`;
code = code.replace(refSearch, refReplace);

const phaseSearch = `    const pendingMetadataItems = items.filter(i => i.status === 'pending' && !i.title && i.thumb);
    const pendingCategoryItems = items.filter(i => i.status === 'pending' && i.title && !i.category);
    
    // We only process categories if there are NO pending metadata items in the ENTIRE queue.
    const isMetadataPhase = pendingMetadataItems.length > 0;
    const pendingItems = isMetadataPhase ? pendingMetadataItems : pendingCategoryItems;`;

const phaseReplace = `    const pendingMetadataItems = items.filter(i => i.status === 'pending' && !i.title && i.thumb);
    const pendingCategoryItems = items.filter(i => i.status === 'pending' && i.title && !i.category);
    
    const isProcessingMetadata = items.some(i => (i.status === 'processing' || i.status === 'compressing') && !i.title);
    
    // Phase 1 is incomplete if there are pending metadata items OR items currently processing metadata.
    const isMetadataPhase = pendingMetadataItems.length > 0 || isProcessingMetadata;
    const pendingItems = isMetadataPhase ? pendingMetadataItems : pendingCategoryItems;

    if (!isMetadataPhase && pendingCategoryItems.length > 0 && lastPhaseRef.current !== 'category') {
        lastPhaseRef.current = 'category';
        showNotification('Phase 2 Started', 'Metadata complete. Now generating categories...');
    } else if (isMetadataPhase && lastPhaseRef.current !== 'metadata') {
        lastPhaseRef.current = 'metadata';
    }`;

code = code.replace(phaseSearch, phaseReplace);
fs.writeFileSync('src/App.tsx', code);
