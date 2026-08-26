const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix /api/collect-keys
code = code.replace(
  /const firestoreKeys = await fetchKeysFromFirestore\(idToken\) \|\| loadStoredKeys\(\);/g,
  `const firestoreFetched = await fetchKeysFromFirestore(idToken);
            const fileKeys = loadStoredKeys();
            const firestoreKeys = firestoreFetched !== null && firestoreFetched.length > 0 ? firestoreFetched : fileKeys;
            
            // Merge them carefully to ensure no file keys are lost
            if (firestoreFetched !== null && firestoreFetched.length >= 0) {
                const keyMap = new Map();
                for (const fk of fileKeys) { keyMap.set(fk.keyHash || fk.id, fk); }
                for (const fsk of firestoreFetched) {
                    const existing = keyMap.get(fsk.keyHash || fsk.id);
                    if (existing) {
                        if (!existing.contributorName && fsk.contributorName) existing.contributorName = fsk.contributorName;
                        if (!existing.contributedBy && fsk.contributedBy) existing.contributedBy = fsk.contributedBy;
                        if (!existing.contributorEmail && fsk.contributorEmail) existing.contributorEmail = fsk.contributorEmail;
                    } else {
                        keyMap.set(fsk.keyHash || fsk.id, fsk);
                    }
                }
                firestoreKeys.length = 0;
                firestoreKeys.push(...Array.from(keyMap.values()));
            }`
);

fs.writeFileSync('server.ts', code);
