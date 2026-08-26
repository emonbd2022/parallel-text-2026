const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const configImplementation = `let globalCentralModeEnabled = true;
const CONFIG_FILE = require('path').join(process.cwd(), 'central-config.json');
function loadConfig() {
    try { if(require('fs').existsSync(CONFIG_FILE)) { const data = JSON.parse(require('fs').readFileSync(CONFIG_FILE, 'utf8')); if(data.centralModeEnabled !== undefined) globalCentralModeEnabled = data.centralModeEnabled; } } catch(e) {}
}
function saveConfig() {
    try { require('fs').writeFileSync(CONFIG_FILE, JSON.stringify({ centralModeEnabled: globalCentralModeEnabled })); } catch(e) {}
}
loadConfig();

app.get("/api/admin/config", (req, res) => res.json({ centralModeEnabled: globalCentralModeEnabled }));
app.post("/api/admin/config", (req, res) => {
     if (req.body.centralModeEnabled !== undefined) {
         globalCentralModeEnabled = !!req.body.centralModeEnabled;
         saveConfig();
     }
     res.json({ success: true, centralModeEnabled: globalCentralModeEnabled });
});

app.post("/api/admin/keys/deduplicate", async (req, res) => {
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

        const uniqueMap = new Map();
        let removedCount = 0;
        for (const sk of storedKeys) {
            let rawVal = '';
            try { rawVal = decrypt(sk.encryptedKey); } catch(e) { rawVal = sk.encryptedKey; }
            if (!uniqueMap.has(rawVal)) {
                uniqueMap.set(rawVal, sk);
            } else {
                removedCount++;
            }
        }
        const dedupedKeys = Array.from(uniqueMap.values());
        saveStoredKeys(dedupedKeys);
        invalidateCentralCache();
        await saveKeysToFirestoreDocument(dedupedKeys, idToken);
        res.json({ success: true, removedCount, remainingCount: dedupedKeys.length });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

app.delete("/api/admin/keys", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
        saveStoredKeys([]);
        invalidateCentralCache();
        await saveKeysToFirestoreDocument([], idToken);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

app.get("/api/admin/keys/:id/reveal", async (req, res) => {
    try {
        const id = req.params.id;
        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
        const firestoreFetched = await fetchKeysFromFirestore(idToken);
        const fileKeys = loadStoredKeys();
        let storedKeys = firestoreFetched !== null && firestoreFetched.length > 0 ? firestoreFetched : fileKeys;
        if (firestoreFetched !== null && firestoreFetched.length >= 0) {
            const keyMap = new Map();
            for (const fk of fileKeys) { keyMap.set(fk.keyHash || fk.id, fk); }
            for (const fsk of firestoreFetched) { keyMap.set(fsk.keyHash || fsk.id, fsk); }
            storedKeys = Array.from(keyMap.values());
        }
        const sk = storedKeys.find(k => k.id === id);
        if (!sk) return res.status(404).json({ error: "Key not found" });
        let decryptedKey = '';
        try { decryptedKey = decrypt(sk.encryptedKey); } catch (e) { decryptedKey = sk.encryptedKey; }
        res.json({ success: true, key: decryptedKey });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});
`;

code = code.replace('app.get("/api/admin/keys", async (req, res) => {', configImplementation + '\napp.get("/api/admin/keys", async (req, res) => {');

// Enforce Central Mode check
const centralModeCheck = `if (!globalCentralModeEnabled && !isAdmin && !hasExplicitAdminGrant) {
    return res.status(403).json({ success: false, error: "Central API Mode is currently disabled by the administrator.", keys: [] });
}
`;

code = code.replace('if (!isEligible) {', centralModeCheck + '\n            if (!isEligible) {');
// we have multiple 'if (!isEligible) {', wait actually there's one in pool-sync and one in central-generate and central-category?
// Actually I'll use regex.
// Wait, the regex might replace too much. Let's do it safely.
fs.writeFileSync('server.ts', code);
