const fs = require('fs');

const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');

const startLine = 576; // 0-indexed would be 575

// Find where `const ai = new GoogleGenAI({ apiKey });` is
let endLine = -1;
for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes('const ai = new GoogleGenAI({ apiKey });')) {
        endLine = i;
        break;
    }
}

if (endLine !== -1) {
    const newCode = `        // Central API Eligibility Check
        let isEligible = false;
        let localKeyCount = 0;
        if (isAdmin || hasExplicitAdminGrant) {
            isEligible = true;
        } else if (Array.isArray(localKeys)) {
            const uniqueKeys = new Set(localKeys.map((k) => k.trim()).filter(k => k.startsWith('AIza') && k.length > 20));
            localKeyCount = uniqueKeys.size;
            if (localKeyCount >= 1) {
                isEligible = true;
            }
        }

        if (!isEligible) {
            return res.status(403).json({ success: false, error: "Central API access requires at least 1 unique local API key or Administrator approval.", keys: [], count: 0 });
        }

        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
        const centralKeys = await syncCentralKeys(isForceRefresh, idToken);
        let poolKeys: any[] = [];
        
        if (centralKeys.length > 0) {
            poolKeys = centralKeys.map((k, index) => ({
                id: \`central-\${index}\`,
                label: \`Central Pool Node \${index + 1}\`,
                key: \`central-\${index}\`
            }));
        } else if (process.env.GEMINI_API_KEY && !isProductionEnv()) {
            poolKeys = [{
                id: 'central-0',
                label: 'Central Primary Node',
                key: 'central-0'
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
        res.status(500).json({ success: false, error: "Failed to fetch central keys", keys: [], count: 0 });
    }
});

apiRouter.post("/central-generate", async (req, res) => {
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { items = [], config = {}, virtualKeyId: vId, nodeId, localKeys, isAdmin, hasExplicitAdminGrant } = body;
        const virtualKeyId = vId || nodeId;

        const settings = await fetchSettingsFromFirestore();
        if (!settings.centralModeEnabled && !isAdmin && !hasExplicitAdminGrant) {
            throw new Error("Central Mode is disabled by administrator.");
        }
        
        // Central API Eligibility Check
        const uid = getUidFromToken(req.headers.authorization);
        if (!uid) throw new Error("Unauthorized: Please sign in to use Central API");
        
        let localKeyCount = 0;
        if (Array.isArray(localKeys)) {
            const uniqueKeys = new Set(localKeys.map((k: string) => k.trim()).filter(k => k.startsWith('AIza') && k.length > 20));
            localKeyCount = uniqueKeys.size;
        }

        const limitRequests = localKeyCount * 100;
        if (!isAdmin && !hasExplicitAdminGrant && localKeyCount === 0) {
            throw new Error("Central API access requires at least 1 Local API key.");
        }

        const date = getUsagePeriodId();
        const usedRequests = await fetchUserUsage(uid, date);
        const requiredRequests = items.length; // 1 request per image for this endpoint

        if (!isAdmin && !hasExplicitAdminGrant && (usedRequests + requiredRequests > limitRequests)) {
            throw new Error(\`Daily Central API limit exceeded. You have \${Math.max(0, limitRequests - usedRequests)} requests remaining.\`);
        }

        incrementUserUsage(uid, requiredRequests, date);

        const apiKey = await getRealKey(virtualKeyId);
        const ai = new GoogleGenAI({ apiKey });`;
        
    lines.splice(575, endLine - 575 + 1, newCode);
    fs.writeFileSync('server.ts', lines.join('\n'));
    console.log('Fixed server.ts');
} else {
    console.log('Could not find end of broken region');
}
