import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";
import { DEFAULT_CENTRAL_KEYS } from './src/data/centralKeysData';

dotenv.config();

const DATA_FILE = path.join(process.cwd(), 'central-keys.json');

const SECRET_KEY = process.env.CENTRAL_API_SECRET_KEY || 'development_secret_key_needs_32_bytes!';
// Ensure it's exactly 32 bytes
const keyBuffer = crypto.createHash('sha256').update(SECRET_KEY).digest();

export function encrypt(text: string) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encText: string) {
    if (!encText) return '';
    if (!encText.includes(':')) return encText;
    const parts = encText.split(':');
    if (parts.length < 3) return encText;
    const [ivHex, authTagHex, encrypted] = parts;
    if (!ivHex || !authTagHex || !encrypted) return encText;
    try {
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (e) {
        if (encText.length > 20 && !encText.includes(':')) {
            return encText;
        }
        return '';
    }
}

// In-memory cache of central keys
interface StoredKey {
    id: string;
    label: string;
    encryptedKey: string;
    keyHash: string;
    enabled: boolean;
    createdAt: string;
    contributedBy?: string;
    contributorName?: string;
    contributorEmail?: string;
}

let centralKeys: { id: string; key: string }[] = [];
let lastCentralKeysFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL
let centralKeyRefreshPromise: Promise<{ id: string; key: string }[]> | null = null;

function loadStoredKeys(): StoredKey[] {
    try {
        const locations = [
            path.join(process.cwd(), 'central-keys.json'),
            path.resolve('central-keys.json')
        ];
        for (const loc of locations) {
            if (fs.existsSync(loc)) {
                const data = fs.readFileSync(loc, 'utf8');
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        }
    } catch (e) {
        console.error("Error reading central-keys.json:", e);
    }
    return DEFAULT_CENTRAL_KEYS || [];
}

function saveStoredKeys(keys: StoredKey[]) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(keys, null, 2));
    } catch (e) {
        console.error("Error writing central-keys.json:", e);
    }
}

/**
 * Fetches central keys from Firestore single document central_keys/APIkeys via REST API
 */
async function fetchKeysFromFirestore(idToken?: string): Promise<StoredKey[] | null> {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';

    if (!projectId) {
        return null;
    }

    // Without an admin idToken, we cannot read the central_keys collection due to strict Firestore rules.
    // Skip the network request to avoid unnecessary 403 errors.
    if (!idToken) {
        return null;
    }

    try {
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/central_keys/APIkeys${apiKey ? `?key=${apiKey}` : ''}`;
        const headers: any = {};
        if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
        }
        
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
            if (resp.status === 404) {
                return [];
            }
            console.log(`[Server] Firestore REST fetch status ${resp.status} (Using local cache fallback)`);
            return null;
        }
        const data = (await resp.json()) as any;
        const fields = data.fields || {};
        const rawKeysArray = fields.keys?.arrayValue?.values || [];

        const items: StoredKey[] = [];
        for (const item of rawKeysArray) {
            const kf = item.mapValue?.fields || {};
            const id = kf.id?.stringValue || crypto.randomUUID();
            const label = kf.label?.stringValue || 'Central Key';
            const rawKey = kf.key?.stringValue || '';
            let encryptedKey = kf.encryptedKey?.stringValue || '';
            const keyHash = kf.keyHash?.stringValue || '';
            const enabled = kf.enabled?.booleanValue !== false;
            const createdAt = kf.createdAt?.stringValue || new Date().toISOString();
            const rawContributedBy = kf.contributedBy?.stringValue;
            const rawContributorName = kf.contributorName?.stringValue;
            const contributorEmail = kf.contributorEmail?.stringValue || '';
            
            let contributorName = '';
            if (rawContributorName && rawContributorName !== label && rawContributorName !== 'central' && rawContributorName !== 'anonymous' && rawContributorName !== 'Community Contributor') {
                contributorName = rawContributorName;
            } else if (rawContributedBy && rawContributedBy !== label && rawContributedBy !== 'central' && rawContributedBy !== 'anonymous' && rawContributedBy !== 'Community Contributor') {
                contributorName = rawContributedBy;
            } else if (contributorEmail) {
                contributorName = contributorEmail.split('@')[0];
            } else {
                contributorName = label || 'Contributor';
            }
            const contributedBy = contributorName;

            // Encrypt plaintext keys if needed
            if (!encryptedKey && rawKey) {
                if (rawKey.includes(':') && rawKey.length > 40) {
                    encryptedKey = rawKey;
                } else {
                    encryptedKey = encrypt(rawKey);
                }
            }

            if (encryptedKey || rawKey) {
                items.push({
                    id,
                    label,
                    encryptedKey: encryptedKey || encrypt(rawKey),
                    keyHash: keyHash || crypto.createHash('sha256').update(rawKey || encryptedKey).digest('hex'),
                    enabled,
                    createdAt,
                    contributedBy,
                    contributorName,
                    contributorEmail
                });
            }
        }
        return items;
    } catch (err) {
        console.log("[Server] Notice fetching Firestore central_keys/APIkeys:", err);
        return null;
    }
}

/**
 * Saves all central keys to the single Firestore document central_keys/APIkeys
 */
async function saveKeysToFirestoreDocument(keys: StoredKey[], idToken?: string): Promise<boolean> {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';

    if (!projectId) return false;

    try {
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/central_keys/APIkeys${apiKey ? `?key=${apiKey}` : ''}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
        }

        const values = keys.map(k => ({
            mapValue: {
                fields: {
                    id: { stringValue: k.id || crypto.randomUUID() },
                    label: { stringValue: k.label || 'Central Key' },
                    encryptedKey: { stringValue: k.encryptedKey || '' },
                    keyHash: { stringValue: k.keyHash || '' },
                    enabled: { booleanValue: k.enabled !== false },
                    createdAt: { stringValue: k.createdAt || new Date().toISOString() },
                    contributedBy: { stringValue: k.contributedBy || 'central' },
                    contributorName: { stringValue: k.contributorName || 'User' },
                    contributorEmail: { stringValue: k.contributorEmail || '' }
                }
            }
        }));

        const body = {
            fields: {
                keys: {
                    arrayValue: {
                        values
                    }
                },
                totalCount: { integerValue: keys.length.toString() },
                updatedAt: { stringValue: new Date().toISOString() }
            }
        };

        const resp = await fetch(url, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body)
        });

        return resp.ok;
    } catch (e) {
        console.log('[Server] Notice saving central_keys/APIkeys to Firestore:', e);
        return false;
    }
}

/**
 * Server-side centralized key registry synchronizer with concurrency lock
 */
async function syncCentralKeys(forceRefresh = false, idToken?: string): Promise<{ id: string; key: string }[]> {
    const now = Date.now();
    // Return warm cache if valid
    if (!forceRefresh && centralKeys.length > 0 && (now - lastCentralKeysFetchTime < CACHE_TTL_MS)) {
        return centralKeys;
    }

    // In-flight refresh lock: concurrent requests await the exact same promise
    if (centralKeyRefreshPromise) {
        return await centralKeyRefreshPromise;
    }

    centralKeyRefreshPromise = (async () => {
        try {
            console.log(`[Server] Performing controlled Central API registry sync (forceRefresh=${forceRefresh})...`);
            
            // 1. Fetch from Firestore (ONE query)
            const firestoreKeys = await fetchKeysFromFirestore(idToken);

            // Handle failure
            if (firestoreKeys === null) {
                lastCentralKeysFetchTime = Date.now(); // Prevent tight retry loop
                if (centralKeys.length > 0) {
                    return centralKeys;
                }
            }

            // 2. Fetch from local file storage
            const fileKeys = loadStoredKeys();

            // Merge unique by keyHash and preserve contributor metadata
            const keyMap = new Map<string, StoredKey>();
            for (const fk of fileKeys) {
                keyMap.set(fk.keyHash || fk.id, fk);
            }
            if (firestoreKeys !== null) {
                for (const fsk of firestoreKeys) {
                    const existing = keyMap.get(fsk.keyHash || fsk.id);
                    if (existing) {
                        if (!existing.contributorName && fsk.contributorName) existing.contributorName = fsk.contributorName;
                        if (!existing.contributedBy && fsk.contributedBy) existing.contributedBy = fsk.contributedBy;
                        if (!existing.contributorEmail && fsk.contributorEmail) existing.contributorEmail = fsk.contributorEmail;
                    } else {
                        keyMap.set(fsk.keyHash || fsk.id, fsk);
                    }
                }
            }

            const allStored = Array.from(keyMap.values());
            if (allStored.length > 0) {
                saveStoredKeys(allStored);
            }

            const active = allStored.filter(k => k.enabled !== false).map(data => {
                let decryptedKey = '';
                try {
                    decryptedKey = decrypt(data.encryptedKey || (data as any).key);
                } catch (e) {
                    if (data.encryptedKey && (data.encryptedKey.startsWith('AIza') || data.encryptedKey.startsWith('AQ.'))) {
                        decryptedKey = data.encryptedKey;
                    }
                }
                if (!decryptedKey && (data as any).key) {
                    decryptedKey = (data as any).key;
                }
                return { id: data.id, key: decryptedKey };
            }).filter(k => k.key && k.key.length > 0);

            centralKeys = active;
            lastCentralKeysFetchTime = Date.now();
            console.log(`[Server] Central API key registry active count: ${centralKeys.length} nodes`);
            return centralKeys;
        } catch (error) {
            console.log("[Server] Error in syncCentralKeys:", error);
            return centralKeys;
        } finally {
            centralKeyRefreshPromise = null;
        }
    })();

    return await centralKeyRefreshPromise;
}

function invalidateCentralCache() {
    lastCentralKeysFetchTime = 0;
    console.log('[Server] Central API registry cache invalidated (event-driven).');
}

export const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper to map a virtual key ID like 'central-5' or a UUID to a real key in server memory
async function getRealKey(virtualKeyId: string): Promise<string> {
    if (virtualKeyId && virtualKeyId.startsWith('AIza')) {
        return virtualKeyId;
    }
    
    await syncCentralKeys();
    if (centralKeys.length > 0) {
        let index = -1;
        if (virtualKeyId) {
            if (virtualKeyId.startsWith('central-')) {
                const num = parseInt(virtualKeyId.split('-')[1], 10);
                if (!isNaN(num) && num >= 0 && num < centralKeys.length) {
                    index = num;
                }
            }
            if (index === -1) {
                const foundIdx = centralKeys.findIndex(k => k.id === virtualKeyId);
                if (foundIdx !== -1) index = foundIdx;
            }
        }
        if (index === -1) index = 0;
        return centralKeys[index % centralKeys.length].key;
    }
    if (process.env.GEMINI_API_KEY) {
        return process.env.GEMINI_API_KEY;
    }
    throw new Error("No Central API keys available in server pool. Please add a key or try again.");
}

// Fire non-blocking initial central keys sync in background
syncCentralKeys().catch(e => console.log("[Server] Background sync notice:", e));

// Capacity endpoint for client
app.get("/api/central-keys-capacity", (req, res) => {
        const stored = loadStoredKeys();
        const fallbackCount = process.env.GEMINI_API_KEY ? 1 : 0;
        const totalActive = centralKeys.length > 0 ? centralKeys.length : fallbackCount;
        res.json({ 
            capacity: totalActive,
            activeCount: centralKeys.length,
            totalCount: stored.length,
            hasFallback: !!process.env.GEMINI_API_KEY
        });
    });

    // 1-Read Central API Keys Pool for Runtime Client Processing (Safe Virtual Node Handles Only)
    app.get("/api/central-keys-pool", async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            await syncCentralKeys(false, idToken);

            let poolKeys: { id: string; label: string; key: string }[] = [];
            if (centralKeys.length > 0) {
                // Return ANONYMOUS VIRTUAL HANDLES. Real decrypted keys NEVER touch the browser.
                poolKeys = centralKeys.map((_, index) => ({
                    id: `central-${index}`,
                    label: `Central Pool Node ${index + 1}`,
                    key: `central-${index}`
                }));
            } else if (process.env.GEMINI_API_KEY) {
                poolKeys = [{
                    id: 'central-0',
                    label: 'Central Pool Primary Node',
                    key: 'central-0'
                }];
            }

            res.json({
                success: true,
                keys: poolKeys,
                count: poolKeys.length
            });
        } catch (error: any) {
            console.error("Error fetching central keys pool:", error);
            res.status(500).json({ success: false, error: "Failed to fetch central keys", details: String(error?.message || error), stack: String(error?.stack || ''), keys: [] });
        }
    });

    // New endpoint to securely return node handles to eligible clients
    app.post("/api/central-keys-pool-sync", async (req, res) => {
        try {
            const { localKeys, isAdmin, hasExplicitAdminGrant, forceRefresh } = req.body || {};
            const isForceRefresh = forceRefresh === true || req.query.refresh === 'true';
            
            // Central API Eligibility Check
            let isEligible = false;
            if (isAdmin || hasExplicitAdminGrant) {
                isEligible = true;
            } else if (Array.isArray(localKeys)) {
                const rawKeyList = Array.isArray(localKeys) ? localKeys : [];
                const extractedKeys = rawKeyList
                    .map((k: any) => typeof k === 'string' ? k.trim() : (typeof k?.key === 'string' ? k.key.trim() : ''))
                    .filter(Boolean);
                const uniqueKeys = new Set(extractedKeys.filter(k => (k.startsWith('AIza') || k.startsWith('AQ.')) && k.length > 20));
                if (uniqueKeys.size >= 8) {
                    isEligible = true;
                }
            }

            if (!isEligible) {
                return res.status(403).json({ success: false, error: "Central API access requires at least 8 unique local API keys or Administrator approval.", keys: [] });
            }

            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            await syncCentralKeys(isForceRefresh, idToken);

            let poolKeys: { id: string; label: string; key: string }[] = [];
            if (centralKeys.length > 0) {
                // Return ANONYMOUS VIRTUAL HANDLES. Real decrypted keys NEVER touch the browser.
                poolKeys = centralKeys.map((k, index) => ({
                    id: `central-${index}`,
                    label: `Central Pool Node ${index + 1}`,
                    key: `central-${index}`
                }));
            } else if (process.env.GEMINI_API_KEY) {
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
            res.status(500).json({ success: false, error: "Failed to fetch central keys", keys: [] });
        }
    });

    app.post("/api/central-generate", async (req, res) => {
        try {
            const { items = [], config = {}, virtualKeyId: vId, nodeId, localKeys, isAdmin, hasExplicitAdminGrant } = req.body;
            const virtualKeyId = vId || nodeId;
            
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
                throw new Error("Central API access requires at least 8 unique local API keys or Administrator approval.");
            }

            const apiKey = await getRealKey(virtualKeyId);
            const ai = new GoogleGenAI({ apiKey });
            
            const promptParts: any[] = [];
            items.forEach((item: any) => {
                const base64Data = item.base64Image.split(',')[1];
                const mimeType = item.base64Image.substring(item.base64Image.indexOf(':') + 1, item.base64Image.indexOf(';'));
                promptParts.push({ inlineData: { mimeType, data: base64Data } });
            });

            const transparencyDirective = config.forceTransparency
                ? `Each image contains a subject isolated on a transparent background. You MUST explicitly include the exact phrase "isolated on transparent background" in the title for every image.`
                : `Analyze the background of each image carefully.
                - If an image background is transparent, you MUST include "isolated on transparent background" in the title.
                - If an image background is solid white, you MUST include "isolated on white background" in the title.`;

            const systemInstruction = `You are an expert Adobe Stock contributor and metadata creator.
Your goal is to generate Adobe Stock-ready metadata for the provided images.

1. Create a highly commercial and descriptive title containing highly searched keywords.
   - The title MUST consist of 1 to 2 complete sentences.
   - The first sentence should vividly describe the main subject, setting, action, and lighting (e.g., "Grain pouring into a large pile in a warehouse.").
   - The final sentence MUST suggest a practical use case or conceptual theme for the image (e.g., "Food supply concept for industrial trade ads.").
   - ${transparencyDirective}
   - CRITICAL: The ENTIRE title MUST be precise, using a maximum of 25 words, and strictly UNDER ${config.titleMaxLen || 180} characters in length (including spaces). Be extremely concise.

2. Produce exactly ${config.keywordsCount} accurate, SEO-friendly keywords optimized for Adobe Stock sales.
   - Focus on conceptual terms, emotions, setting, lighting, and specific subject details.
   - Include synonyms and related concepts that buyers might search for.
   - Avoid generic or irrelevant terms.
   - ORDER them strictly by relevance and visual importance—from most critical to least important. The first 10 keywords dictate search ranking and MUST be the strongest descriptors. DO NOT sort the keywords alphabetically. Exclude all trademarks.`;

            const promptText = `I have provided ${items.length} image(s).
Generate Adobe Stock-ready metadata for EACH image in the exact order they were provided (Index 0 to ${items.length - 1}).

Return a strictly valid JSON array where each object contains:
- "index": integer (0-based index corresponding to the input order)
- "title": string
- "keywords": array of strings`;

            promptParts.push({ text: promptText });

            const response = await ai.models.generateContent({
                model: config.model || 'gemini-2.0-flash',
                contents: promptParts,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                index: { type: Type.INTEGER },
                                title: { type: Type.STRING },
                                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                                category: { type: Type.STRING }
                            },
                            required: ["index", "title", "keywords"]
                        }
                    }
                }
            });

            const text = response.text;
            if (!text) throw new Error("No response from AI");

            let jsonArray: any[];
            try {
                let cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim(); const match = cleanText.match(/\[[\s\S]*\]/); if (match) cleanText = match[0]; jsonArray = JSON.parse(cleanText);
                if (!Array.isArray(jsonArray)) throw new Error("AI did not return an array");
            } catch (e) {
                throw new Error("Invalid JSON response from AI");
            }

            const results: Record<string, any> = {};
            jsonArray.forEach((resItem: any) => {
                const idx = resItem.index;
                if (idx >= 0 && idx < items.length) {
                    const originalId = items[idx].id;
                    const keywordsStr = Array.isArray(resItem.keywords) 
                        ? resItem.keywords.slice(0, config.keywordsCount).join(', ') 
                        : '';
                    results[originalId] = {
                        title: resItem.title,
                        keywords: keywordsStr,
                    };
                }
            });

            res.json(results);
        } catch (error: any) {
            console.error("Central API Error:", error);
            res.status(500).json({ error: String(error?.message || error), stackString: String(error?.stack || '') });
        }
    });

    app.post("/api/central-category", async (req, res) => {
        try {
            const { items, model, virtualKeyId: vId, nodeId, localKeys, isAdmin, hasExplicitAdminGrant } = req.body;
            const virtualKeyId = vId || nodeId;
            
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
                throw new Error("Central API access requires at least 8 unique local API keys or Administrator approval.");
            }

            const apiKey = await getRealKey(virtualKeyId);
            const ai = new GoogleGenAI({ apiKey });
            
            const systemInstruction = `# Adobe Stock Category Generation — Master Instructions

You are an expert Adobe Stock content reviewer and category classifier.

Your task is to determine the **single best Adobe Stock category** for a given title.

The title describes the primary subject, concept, scene, or commercial intent of an image.

## Critical Workflow

The workflow is:
TITLE
↓
Analyze the title
↓
Determine the primary subject, context, mood, and intent
↓
Select exactly ONE Adobe Stock category
↓
Return ONLY the category NAME

**Never return the category number.**

---

# Available Adobe Stock Categories

Use ONLY one of these 21 categories:

1. Animals
2. Buildings and Architecture
3. Business
4. Drinks
5. The Environment
6. States of Mind
7. Food
8. Graphic Resources
9. Hobbies and Leisure
10. Industry
11. Landscapes
12. Lifestyle
13. People
14. Plants and Flowers
15. Culture and Religion
16. Science
17. Social Issues
18. Sports
19. Technology
20. Transport
21. Travel

These are the application's authoritative category names.`;

            const promptText = `I have provided ${items.length} titles.
For EACH title, assign the single best Adobe Stock category from the allowed list.

Return a strictly valid JSON array where each object contains:
- "index": integer (0-based index corresponding to the input order)
- "category": string (the exact category name)`;

            const promptParts: any[] = [{ text: promptText }];
            items.forEach((item: any, index: number) => {
                promptParts.push({ text: `Title ${index}: ${item.title}` });
            });

            const response = await ai.models.generateContent({
                model: model || 'gemini-2.0-flash',
                contents: promptParts,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                index: { type: Type.INTEGER },
                                category: { type: Type.STRING }
                            },
                            required: ["index", "category"]
                        }
                    }
                }
            });

            const text = response.text;
            if (!text) throw new Error("No response from AI");

            let jsonArray: any[];
            try {
                let cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim(); const match = cleanText.match(/\[[\s\S]*\]/); if (match) cleanText = match[0]; jsonArray = JSON.parse(cleanText);
                if (!Array.isArray(jsonArray)) throw new Error("AI did not return an array");
            } catch (e) {
                throw new Error("Invalid JSON response from AI");
            }

            const results: Record<string, { category: string }> = {};
            jsonArray.forEach((resItem: any) => {
                const idx = resItem.index;
                if (idx >= 0 && idx < items.length) {
                    const originalId = items[idx].id;
                    results[originalId] = {
                        category: resItem.category
                    };
                }
            });

            res.json(results);
        } catch (error: any) {
            console.error("Central API Error:", error);
            res.status(500).json({ error: error.message || "Internal Server Error" });
        }
    });

    // Endpoint for users to automatically contribute keys to the central pool
    app.post("/api/collect-keys", async (req, res) => {
        try {
            const { keys } = req.body || {};
            if (!Array.isArray(keys)) return res.status(400).json({ success: false, error: "Expected array of keys" });

            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;

            let added = 0;
            let modified = false;
            const firestoreKeys = await fetchKeysFromFirestore(idToken) || loadStoredKeys();
            
            for (const rawK of keys) {
                if (!rawK) continue;
                const rawVal = typeof rawK === 'string' ? rawK : (rawK.key || '');
                if (typeof rawVal !== 'string') continue;
                const keyVal = rawVal.trim();
                if (keyVal.length < 10 || keyVal.startsWith('central-')) continue;

                const labelVal = typeof rawK === 'object' && rawK?.label ? String(rawK.label) : 'User Contributed Key';
                const contribName = typeof rawK === 'object' ? rawK.contributorName : '';
                const contribBy = typeof rawK === 'object' ? rawK.contributedBy : '';
                const contribEmail = typeof rawK === 'object' ? rawK.contributorEmail : '';

                const keyHash = crypto.createHash('sha256').update(keyVal).digest('hex');
                const existing = firestoreKeys.find(sk => sk && sk.keyHash === keyHash);
                const exactContributor = (contribName || (contribBy && contribBy !== 'central' && contribBy !== 'anonymous' && contribBy !== 'Community Contributor' ? contribBy : '') || (contribEmail ? contribEmail.split('@')[0] : '') || '').trim() || 'Contributor';

                if (existing) {
                    if (exactContributor && exactContributor !== 'Contributor') {
                        if (existing.contributorName !== exactContributor || existing.contributedBy !== exactContributor) {
                            existing.contributorName = exactContributor;
                            existing.contributedBy = exactContributor;
                            modified = true;
                        }
                    }
                    if (contribEmail && existing.contributorEmail !== contribEmail) {
                        existing.contributorEmail = contribEmail;
                        modified = true;
                    }
                    continue; 
                }

                const encryptedKey = encrypt(keyVal);
                firestoreKeys.push({
                    id: crypto.randomUUID(),
                    label: labelVal,
                    encryptedKey,
                    keyHash,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    contributedBy: exactContributor,
                    contributorName: exactContributor,
                    contributorEmail: contribEmail || ''
                });
                added++;
            }
            if (added > 0 || modified) {
                await saveKeysToFirestoreDocument(firestoreKeys, idToken);
                saveStoredKeys(firestoreKeys);
                invalidateCentralCache();
            }
            res.json({ success: true, added, total: firestoreKeys.length });
        } catch (e: any) {
            console.error("Error collecting keys:", e);
            res.status(500).json({ success: false, error: String(e?.message || e), stack: String(e?.stack || '') });
        }
    });

    // Admin endpoints to manage Central Keys
    app.post("/api/admin/keys", async (req, res) => {
        try {
            const { label, key, contributorName, contributedBy, contributorEmail } = req.body;
            if (!label || !key) return res.status(400).send("Label and key required");
            
            const encryptedKey = encrypt(key.trim());
            const keyHash = crypto.createHash('sha256').update(key.trim()).digest('hex');
            
            const storedKeys = loadStoredKeys();
            const existing = storedKeys.find(sk => sk.keyHash === keyHash);
            if (existing) {
                return res.status(400).json({ error: "Key already exists in the central pool" });
            }

            const exactContributor = (contributorName || contributedBy || '').trim() || (contributorEmail ? contributorEmail.split('@')[0] : '') || 'Admin';

            const newKey: StoredKey = {
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
            storedKeys.push(newKey);
            saveStoredKeys(storedKeys);
            
            invalidateCentralCache();
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            await saveKeysToFirestoreDocument(storedKeys, idToken);

            res.json({ id: newKey.id, label: newKey.label, enabled: true });
        } catch (e: any) {
            res.status(500).json({ success: false, error: String(e?.message || e), stack: String(e?.stack || "") });
        }
    });

    app.post("/api/admin/keys/refresh", async (req, res) => {
        try {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            invalidateCentralCache();
            await syncCentralKeys(true, idToken);
            const storedKeys = loadStoredKeys();
            storedKeys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            const keys = storedKeys.map(data => {
                let maskedKey = '••••••••';
                try {
                    const decrypted = decrypt(data.encryptedKey);
                    if (decrypted && decrypted.length >= 8) {
                        maskedKey = `${decrypted.substring(0, 6)}••••••••${decrypted.substring(decrypted.length - 4)}`;
                    }
                } catch (e) {}

                const contributorEmail = data.contributorEmail || '';
                let exactContributor = '';
                if (data.contributorName && data.contributorName !== data.label && data.contributorName !== 'central' && data.contributorName !== 'anonymous' && data.contributorName !== 'Community Contributor') {
                    exactContributor = data.contributorName;
                } else if (data.contributedBy && data.contributedBy !== data.label && data.contributedBy !== 'central' && data.contributedBy !== 'anonymous' && data.contributedBy !== 'Community Contributor') {
                    exactContributor = data.contributedBy;
                } else if (contributorEmail) {
                    exactContributor = contributorEmail.split('@')[0];
                } else {
                    exactContributor = data.label || 'Contributor';
                }

                return {
                    id: data.id,
                    label: data.label,
                    maskedKey,
                    enabled: data.enabled !== false,
                    createdAt: data.createdAt,
                    contributedBy: exactContributor,
                    contributorName: exactContributor,
                    contributorEmail: data.contributorEmail
                };
            });
            const activeKeys = keys.filter(k => k.enabled).length;
            const disabledKeys = keys.filter(k => !k.enabled).length;
            res.json({
                success: true,
                keys,
                totalKeys: keys.length,
                activeKeys,
                disabledKeys,
                updatedAt: new Date().toISOString(),
                version: 1
            });
        } catch (e: any) {
            res.status(500).json({ success: false, error: String(e?.message || e), stack: String(e?.stack || "") });
        }
    });

    app.get("/api/admin/keys", async (req, res) => {
        try {
            const force = req.query.refresh === 'true';
            if (force) {
                const authHeader = req.headers.authorization;
                const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
                invalidateCentralCache();
                await syncCentralKeys(true, idToken);
            }
            const storedKeys = loadStoredKeys();
            // Sort by createdAt descending
            storedKeys.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
            const keys = storedKeys.map(data => {
                let maskedKey = '••••••••';
                try {
                    const decrypted = decrypt(data.encryptedKey);
                    if (decrypted && decrypted.length >= 8) {
                        maskedKey = `${decrypted.substring(0, 6)}••••••••${decrypted.substring(decrypted.length - 4)}`;
                    }
                } catch (e) {}

                const contributorEmail = data.contributorEmail || '';
                let exactContributor = '';
                if (data.contributorName && data.contributorName !== data.label && data.contributorName !== 'central' && data.contributorName !== 'anonymous' && data.contributorName !== 'Community Contributor') {
                    exactContributor = data.contributorName;
                } else if (data.contributedBy && data.contributedBy !== data.label && data.contributedBy !== 'central' && data.contributedBy !== 'anonymous' && data.contributedBy !== 'Community Contributor') {
                    exactContributor = data.contributedBy;
                } else if (contributorEmail) {
                    exactContributor = contributorEmail.split('@')[0];
                } else {
                    exactContributor = data.label || 'Contributor';
                }

                return {
                    id: data.id,
                    label: data.label,
                    maskedKey,
                    enabled: data.enabled !== false,
                    createdAt: data.createdAt,
                    contributedBy: exactContributor,
                    contributorName: exactContributor,
                    contributorEmail: data.contributorEmail
                };
            });
            const activeKeys = keys.filter(k => k.enabled).length;
            const disabledKeys = keys.filter(k => !k.enabled).length;
            res.json({
                keys,
                totalKeys: keys.length,
                activeKeys,
                disabledKeys,
                updatedAt: new Date().toISOString(),
                version: 1
            });
        } catch (e: any) {
            res.status(500).json({ success: false, error: String(e?.message || e), stack: String(e?.stack || "") });
        }
    });

    app.delete("/api/admin/keys/:id", async (req, res) => {
        try {
            let storedKeys = loadStoredKeys();
            storedKeys = storedKeys.filter(k => k.id !== req.params.id);
            saveStoredKeys(storedKeys);
            
            invalidateCentralCache();
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            await saveKeysToFirestoreDocument(storedKeys, idToken);

            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ success: false, error: String(e?.message || e), stack: String(e?.stack || "") });
        }
    });

    app.patch("/api/admin/keys/:id", async (req, res) => {
        try {
            const { enabled } = req.body;
            const storedKeys = loadStoredKeys();
            const key = storedKeys.find(k => k.id === req.params.id);
            if (key) {
                key.enabled = enabled;
                saveStoredKeys(storedKeys);
                invalidateCentralCache();
                const authHeader = req.headers.authorization;
                const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
                await saveKeysToFirestoreDocument(storedKeys, idToken);
            }
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.use((err: any, req: any, res: any, next: any) => {
        console.error("GLOBAL SERVER ERROR:", err);
        res.status(500).json({ error: err.message || "Internal Server Error", stack: err.stack });
    });

    // Catch-all for API endpoints to ensure API requests never fall back to index.html
    app.all('/api/*all', (req, res) => {
        res.status(404).json({ error: `Central API endpoint ${req.method} ${req.path} not found` });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        createViteServer({
            root: process.cwd(),
            server: { middlewareMode: true },
            appType: "spa",
        }).then(vite => {
            app.use(vite.middlewares);
        }).catch(err => {
            console.error("Vite server error:", err);
        });
    } else if (!process.env.VERCEL) {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*all', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    if (!process.env.VERCEL) {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on http://0.0.0.0:${PORT}`);
        });
    }
