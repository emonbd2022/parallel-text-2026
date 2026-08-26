const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix app.delete
code = code.replace(
  /app\.delete\("\/api\/admin\/keys\/:id", async \(req, res\) => \{\s+try \{\s+let storedKeys = loadStoredKeys\(\);\s+storedKeys = storedKeys\.filter\(k => k\.id !== req\.params\.id\);\s+saveStoredKeys\(storedKeys\);\s+invalidateCentralCache\(\);\s+await saveKeysToFirestoreDocument\(storedKeys, idToken\);/g,
  `app.delete("/api/admin/keys/:id", async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            const firestoreFetched = await fetchKeysFromFirestore(idToken);
            const fileKeys = loadStoredKeys();
            let storedKeys = firestoreFetched !== null && firestoreFetched.length > 0 ? firestoreFetched : fileKeys;
            if (firestoreFetched !== null && firestoreFetched.length >= 0) {
                const keyMap = new Map();
                for (const fk of fileKeys) { keyMap.set(fk.keyHash || fk.id, fk); }
                for (const fsk of firestoreFetched) {
                    keyMap.set(fsk.keyHash || fsk.id, fsk);
                }
                storedKeys = Array.from(keyMap.values());
            }

            storedKeys = storedKeys.filter(k => k.id !== req.params.id);
            saveStoredKeys(storedKeys);
            
            invalidateCentralCache();
            await saveKeysToFirestoreDocument(storedKeys, idToken);`
);

// We need to fix app.patch in the same way. Let's see what app.patch looks like.
