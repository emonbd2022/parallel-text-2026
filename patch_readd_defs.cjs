const fs = require('fs');

const code = `
// --- CENTRAL API USAGE TRACKING ---
function getUsagePeriodId() {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    return periodStart.toISOString().split('T')[0];
}

function getUsageDocId(uid, date) {
    return require('crypto').createHmac('sha256', keyBuffer).update(uid + '-' + date).digest('hex');
}

function getUidFromToken(authHeader) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
    if (!token) return null;
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
        return decoded.user_id || decoded.sub || null;
    } catch {
        return null;
    }
}

const usageCache = new Map();
const writeTimeouts = new Map();

async function fetchUserUsage(uid, date) {
    const cached = usageCache.get(uid);
    if (cached && cached.date === date) return cached.count;

    const docId = getUsageDocId(uid, date);
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';
    
    if (projectId) {
        try {
            const url = \`https://firestore.googleapis.com/v1/projects/\${projectId}/databases/\${dbId}/documents/central_usage/\${docId}\`;
            const resp = await fetch(url);
            if (resp.ok) {
                const data = await resp.json();
                const count = parseInt(data.fields?.count?.integerValue || '0', 10);
                usageCache.set(uid, { count, date, dirty: false });
                return count;
            }
        } catch (e) {
            console.error('Failed to fetch user usage:', e);
        }
    }
    
    usageCache.set(uid, { count: 0, date, dirty: false });
    return 0;
}

async function saveUsageToFirestore(uid, count, date) {
    const docId = getUsageDocId(uid, date);
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';
    
    if (projectId) {
        try {
            const url = \`https://firestore.googleapis.com/v1/projects/\${projectId}/databases/\${dbId}/documents/central_usage/\${docId}\`;
            const body = {
                fields: {
                    count: { integerValue: count.toString() },
                    date: { stringValue: date },
                    updatedAt: { stringValue: new Date().toISOString() }
                }
            };
            await fetch(url, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        } catch (e) {
            console.error('Failed to save user usage:', e);
        }
    }
}

function incrementUserUsage(uid, addRequests, date) {
    let usage = usageCache.get(uid);
    if (!usage || usage.date !== date) {
        usage = { count: 0, date, dirty: false };
    }
    usage.count += addRequests;
    usage.dirty = true;
    usageCache.set(uid, usage);

    if (!writeTimeouts.has(uid)) {
        writeTimeouts.set(uid, setTimeout(() => {
            const currentUsage = usageCache.get(uid);
            if (currentUsage && currentUsage.dirty) {
                currentUsage.dirty = false;
                saveUsageToFirestore(uid, currentUsage.count, currentUsage.date).catch(console.error);
            }
            writeTimeouts.delete(uid);
        }, 5000));
    }
}

apiRouter.post("/central-usage", async (req, res) => {
    try {
        const uid = getUidFromToken(req.headers.authorization);
        if (!uid) return res.status(401).json({ error: "Unauthorized" });

        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const localKeys = body.localKeys || [];
        const uniqueKeys = new Set(localKeys.map(k => String(k).trim()).filter(k => k.startsWith('AIza') && k.length > 20));
        const localKeyCount = uniqueKeys.size;
        
        const limitRequests = localKeyCount * 100;
        const limitImages = localKeyCount * 50;
        const date = getUsagePeriodId();
        
        const usedRequests = await fetchUserUsage(uid, date);
        const remainingRequests = Math.max(0, limitRequests - usedRequests);
        const remainingImages = Math.floor(remainingRequests / 2);

        res.json({
            success: true,
            localKeyCount,
            limitRequests,
            limitImages,
            usedRequests,
            remainingRequests,
            remainingImages,
            date
        });
    } catch (e) {
        res.status(500).json({ error: String(e.message || e) });
    }
});
// --- END CENTRAL API USAGE TRACKING ---
`;

let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace("// Mount the API Router under /api", code + "\n// Mount the API Router under /api");
fs.writeFileSync('server.ts', content);
console.log('patched');
