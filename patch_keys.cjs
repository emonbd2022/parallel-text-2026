const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldFillSlots = `    // 4. Fill Slots
    const sortedQueue = [...pendingItems].sort((a, b) => a.attempts - b.attempts);
    const batchSize = config.batchSize || 1;

    // Sort keys: prioritize those with fewer errors (healthier)
    availableKeys.sort((a, b) => {
        const healthA = Math.max(0, 100 - (a.errorCount * 5));
        const healthB = Math.max(0, 100 - (b.errorCount * 5));
        return healthB - healthA;
    });

    let currentItemIndex = 0;
    
    // Iterate through available keys to find work
    for (const chosenKey of availableKeys) {`;

const newFillSlots = `    // 4. Filter Keys By Phase
    let categoryKeyIds = [];
    if (keys.length >= 3) {
        categoryKeyIds = keys.slice(-2).map(k => k.id);
    } else if (keys.length === 2) {
        categoryKeyIds = [keys[1].id];
    }
    
    let phaseAvailableKeys = availableKeys;
    if (categoryKeyIds.length > 0) {
        if (isMetadataPhase) {
            phaseAvailableKeys = availableKeys.filter(k => !categoryKeyIds.includes(k.id));
        } else {
            phaseAvailableKeys = availableKeys.filter(k => categoryKeyIds.includes(k.id));
        }
    }

    if (phaseAvailableKeys.length === 0) {
        setStatusMsg("Waiting for phase-specific keys...");
        return;
    }

    // 5. Fill Slots
    const sortedQueue = [...pendingItems].sort((a, b) => a.attempts - b.attempts);
    const batchSize = config.batchSize || 1;

    // Sort keys: prioritize those with fewer errors (healthier)
    phaseAvailableKeys.sort((a, b) => {
        const healthA = Math.max(0, 100 - (a.errorCount * 5));
        const healthB = Math.max(0, 100 - (b.errorCount * 5));
        return healthB - healthA;
    });

    let currentItemIndex = 0;
    
    // Iterate through available keys to find work
    for (const chosenKey of phaseAvailableKeys) {`;

code = code.replace(oldFillSlots, newFillSlots);
fs.writeFileSync('src/App.tsx', code);
