const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /const storedKeys = loadStoredKeys\(\);/g,
  `const authHeader = req.headers.authorization;
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
            }`
);

fs.writeFileSync('server.ts', code);
