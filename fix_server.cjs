const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

// Replace /api/collect-keys logic
const collectKeysRegex = /app\.post\("\/api\/collect-keys", async \(req, res\) => \{[\s\S]*?res\.json\(\{ success: true, added, total: centralKeys\.length \}\);\n\s*\} catch \(e: any\) \{/g;

const collectKeysReplacement = `app.post("/api/collect-keys", async (req, res) => {
        try {
            const { keys } = req.body;
            if (!Array.isArray(keys)) return res.status(400).send("Expected array of keys");

            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;

            let added = 0;
            const firestoreKeys = await fetchKeysFromFirestore(idToken) || loadStoredKeys();
            
            for (const k of keys) {
                if (!k.key) continue;
                
                const keyHash = crypto.createHash('sha256').update(k.key.trim()).digest('hex');
                const existing = firestoreKeys.find(sk => sk.keyHash === keyHash);
                const exactContributor = (k.contributorName || (k.contributedBy && k.contributedBy !== 'central' && k.contributedBy !== 'anonymous' ? k.contributedBy : '')).trim() || (k.contributorEmail ? k.contributorEmail.split('@')[0] : 'Community Contributor');
                
                if (existing) {
                    if (!existing.contributorName || existing.contributorName === 'central' || existing.contributorName === 'anonymous') {
                        existing.contributorName = exactContributor;
                    }
                    if (!existing.contributedBy || existing.contributedBy === 'central' || existing.contributedBy === 'anonymous') {
                        existing.contributedBy = exactContributor;
                    }
                    if (!existing.contributorEmail && k.contributorEmail) {
                        existing.contributorEmail = k.contributorEmail;
                    }
                    continue; 
                }

                const encryptedKey = encrypt(k.key.trim());
                firestoreKeys.push({
                    id: crypto.randomUUID(),
                    label: k.label || 'User Contributed Key',
                    encryptedKey,
                    keyHash,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    contributedBy: exactContributor,
                    contributorName: exactContributor,
                    contributorEmail: k.contributorEmail || ''
                });
                added++;
            }
            if (added > 0) {
                await saveKeysToFirestoreDocument(firestoreKeys, idToken);
                saveStoredKeys(firestoreKeys);
                invalidateCentralCache();
            }
            res.json({ success: true, added, total: firestoreKeys.length });
        } catch (e: any) {`;

content = content.replace(collectKeysRegex, collectKeysReplacement);

// Replace /api/admin/keys logic
const adminKeysRegex = /app\.post\("\/api\/admin\/keys", async \(req, res\) => \{[\s\S]*?res\.json\(\{ success: true, key: newKey \}\);\n\s*\} catch \(e: any\) \{/g;

const adminKeysReplacement = `app.post("/api/admin/keys", async (req, res) => {
        try {
            const { label, key, contributorName, contributedBy, contributorEmail } = req.body;
            if (!label || !key) return res.status(400).send("Label and key required");

            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            
            const encryptedKey = encrypt(key.trim());
            const keyHash = crypto.createHash('sha256').update(key.trim()).digest('hex');
            
            const firestoreKeys = await fetchKeysFromFirestore(idToken) || loadStoredKeys();
            const existing = firestoreKeys.find(sk => sk.keyHash === keyHash);
            if (existing) {
                return res.status(400).json({ error: "Key already exists in the central pool" });
            }

            const exactContributor = (contributorName || contributedBy || '').trim() || (contributorEmail ? contributorEmail.split('@')[0] : '') || 'Admin';

            const newKey = {
                id: crypto.randomUUID(),
                label: label.trim(),
                encryptedKey,
                keyHash,
                enabled: true,
                createdAt: new Date().toISOString(),
                contributedBy: exactContributor,
                contributorName: exactContributor,
                contributorEmail: contributorEmail || 'admin'
            };
            firestoreKeys.push(newKey);
            
            await saveKeysToFirestoreDocument(firestoreKeys, idToken);
            saveStoredKeys(firestoreKeys);
            invalidateCentralCache();
            
            res.json({ success: true, key: newKey });
        } catch (e: any) {`;

content = content.replace(adminKeysRegex, adminKeysReplacement);

// Add /api/central-keys-pool-sync endpoint for client side directly returning keys
const newEndpoint = `
    // New endpoint to securely return actual keys to eligible clients
    app.post("/api/central-keys-pool-sync", async (req, res) => {
        try {
            const { localKeys, isAdmin, hasExplicitAdminGrant } = req.body;
            
            // Central API Eligibility Check
            let isEligible = false;
            if (isAdmin || hasExplicitAdminGrant) {
                isEligible = true;
            } else if (Array.isArray(localKeys)) {
                const uniqueKeys = new Set(localKeys.map((k: string) => k.trim()).filter(k => k.startsWith('AIza') && k.length > 20));
                if (uniqueKeys.size >= 8) {
                    isEligible = true;
                }
            }

            if (!isEligible) {
                return res.status(403).json({ success: false, error: "Central API access requires at least 8 unique local API keys or Administrator approval.", keys: [] });
            }

            await syncCentralKeys(false);

            let poolKeys: { id: string; label: string; key: string }[] = [];
            if (centralKeys.length > 0) {
                // Return real decrypted keys directly to the client RAM
                poolKeys = centralKeys.map((k, index) => ({
                    id: k.id,
                    label: \`Central Pool Node \${index + 1}\`,
                    key: k.key
                }));
            } else if (process.env.GEMINI_API_KEY) {
                poolKeys = [{
                    id: 'central-0',
                    label: 'Central Pool Primary Node',
                    key: process.env.GEMINI_API_KEY
                }];
            }

            res.json({
                success: true,
                keys: poolKeys,
                count: poolKeys.length,
                timestamp: Date.now()
            });
        } catch (error: any) {
            console.error("Error fetching sync central keys pool:", error);
            res.status(500).json({ success: false, error: "Failed to fetch central keys", keys: [] });
        }
    });
`;

// Insert it right after the GET /api/central-keys-pool
content = content.replace(/app\.get\("\/api\/central-keys-pool", async \(req, res\) => \{[\s\S]*?\}\);\n/g, match => match + newEndpoint);

fs.writeFileSync('server.ts', content);
