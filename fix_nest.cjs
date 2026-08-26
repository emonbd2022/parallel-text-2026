const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// The endpoint we inserted
const badEndpoint = `
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

// Remove the nested badEndpoint
content = content.replace(badEndpoint, "");

// Insert it properly after app.get("/api/central-keys-pool" ... });
content = content.replace(/\}\);\n\n    app\.post\("\/api\/central-generate"/, '});\n' + badEndpoint + '\n    app.post("/api/central-generate"');

fs.writeFileSync('server.ts', content);
