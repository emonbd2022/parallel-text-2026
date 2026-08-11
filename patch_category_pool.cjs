const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldFillSlots = `    // 4. Filter Keys By Phase
    let categoryKeyIds: string[] = [];
    if (keys.length >= 3) {
        categoryKeyIds = keys.slice(-2).map(k => k.id);
    } else if (keys.length === 2) {
        categoryKeyIds = [keys[1].id];
    }
    
    let phaseAvailableKeys = availableKeys;
    if (categoryKeyIds.length > 0) {
        let preferredKeys = availableKeys;
        let fallbackKeys: import("./types").ApiKey[] = [];
        
        if (isMetadataPhase) {
            preferredKeys = availableKeys.filter(k => !categoryKeyIds.includes(k.id));
            fallbackKeys = availableKeys.filter(k => categoryKeyIds.includes(k.id));
        } else {
            preferredKeys = availableKeys.filter(k => categoryKeyIds.includes(k.id));
            fallbackKeys = availableKeys.filter(k => !categoryKeyIds.includes(k.id));
        }

        // Try preferred keys first, then fallback keys
        phaseAvailableKeys = preferredKeys.length > 0 ? preferredKeys : fallbackKeys;
    }

    if (phaseAvailableKeys.length === 0) {
        setStatusMsg("Waiting for available keys...");
        return;
    }`;

const newFillSlots = `    // 4. Filter Keys By Phase
    let categoryKeyIds: string[] = [];
    if (keys.length > 1) {
        const titlePoolSize = Math.ceil(keys.length / 2);
        categoryKeyIds = keys.slice(titlePoolSize).map(k => k.id);
    }
    
    let phaseAvailableKeys = availableKeys;
    if (categoryKeyIds.length > 0) {
        let preferredKeys = availableKeys;
        let fallbackKeys: import("./types").ApiKey[] = [];
        
        if (isMetadataPhase) {
            preferredKeys = availableKeys.filter(k => !categoryKeyIds.includes(k.id));
            fallbackKeys = availableKeys.filter(k => categoryKeyIds.includes(k.id));
        } else {
            preferredKeys = availableKeys.filter(k => categoryKeyIds.includes(k.id));
            fallbackKeys = availableKeys.filter(k => !categoryKeyIds.includes(k.id));
        }

        // Try preferred keys first, then fallback keys
        phaseAvailableKeys = preferredKeys.length > 0 ? preferredKeys : fallbackKeys;
    }

    if (phaseAvailableKeys.length === 0) {
        setStatusMsg("Waiting for available keys...");
        return;
    }`;

code = code.replace(oldFillSlots, newFillSlots);
fs.writeFileSync('src/App.tsx', code);
