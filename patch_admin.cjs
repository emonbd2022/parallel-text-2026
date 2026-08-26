const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Fix /api/admin/keys
code = code.replace(
  /const storedKeys = loadStoredKeys\(\);\s+const existing = storedKeys\.find\(sk => sk\.keyHash === keyHash\);/g,
  `const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            const firestoreFetched = await fetchKeysFromFirestore(idToken);
            const fileKeys = loadStoredKeys();
            const storedKeys = firestoreFetched !== null && firestoreFetched.length > 0 ? firestoreFetched : fileKeys;
            
            if (firestoreFetched !== null && firestoreFetched.length >= 0) {
                const keyMap = new Map();
                for (const fk of fileKeys) { keyMap.set(fk.keyHash || fk.id, fk); }
                for (const fsk of firestoreFetched) {
                    keyMap.set(fsk.keyHash || fsk.id, fsk);
                }
                storedKeys.length = 0;
                storedKeys.push(...Array.from(keyMap.values()));
            }

            const existing = storedKeys.find(sk => sk.keyHash === keyHash);`
);

// We need to remove the redeclaration of authHeader and idToken further down in /api/admin/keys
code = code.replace(
  /const authHeader = req\.headers\.authorization;\s+const idToken = authHeader\?\.startsWith\('Bearer '\) \? authHeader\.split\('Bearer '\)\[1\] : undefined;\s+await saveKeysToFirestoreDocument/g,
  `await saveKeysToFirestoreDocument`
);

fs.writeFileSync('server.ts', code);
