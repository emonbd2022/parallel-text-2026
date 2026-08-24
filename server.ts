import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from "@google/genai";

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
    const [ivHex, authTagHex, encrypted] = encText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// In-memory cache of central keys
interface StoredKey {
    id: string;
    label: string;
    encryptedKey: string;
    keyHash: string;
    maskedKey?: string;
    enabled: boolean;
    createdAt: string;
    contributedBy?: string;
    contributorEmail?: string;
}

let centralKeyCache: { id: string; key: string }[] = [];
let centralKeys: { id: string; key: string }[] = [];
let centralKeyCacheTimestamp = 0;
let centralKeyCacheVersion = 1;
let cachedVersion = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes safety fallback TTL
let centralKeyRefreshPromise: Promise<{ id: string; key: string }[]> | null = null;

// Telemetry & Diagnostics
let centralCacheHits = 0;
let centralCacheMisses = 0;
let centralCacheRefreshes = 0;
let centralCacheInvalidations = 0;
let centralCacheRefreshFailures = 0;

// Single-Document Migration & Registry Metrics
let migrationStatus = 'active';
let legacyDocsMigrated = 0;
let duplicatesRemoved = 0;
let keysInApiKeysDoc = 0;

// Mutex / Concurrency Lock for Atomic Key Mutations
let keyMutationQueue: Promise<any> = Promise.resolve();

async function runWithKeyMutationLock<T>(fn: () => Promise<T>): Promise<T> {
    const res = keyMutationQueue.then(() => fn());
    keyMutationQueue = res.catch(() => {});
    return res;
}

function loadStoredKeys(): StoredKey[] {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Error reading central-keys.json:", e);
    }
    return [];
}

function saveStoredKeys(keys: StoredKey[]) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(keys, null, 2));
    } catch (e) {
        console.error("Error writing central-keys.json:", e);
    }
}

/**
 * Converts StoredKey[] into Firestore REST fields for single central_keys/APIkeys document
 */
function keysToFirestoreDocFields(keys: StoredKey[]) {
    return {
        fields: {
            keys: {
                arrayValue: {
                    values: keys.map(k => ({
                        mapValue: {
                            fields: {
                                id: { stringValue: k.id || '' },
                                label: { stringValue: k.label || 'Central Key' },
                                encryptedKey: { stringValue: k.encryptedKey || '' },
                                maskedKey: { stringValue: k.maskedKey || '••••••••' },
                                keyHash: { stringValue: k.keyHash || '' },
                                contributedBy: { stringValue: k.contributedBy || '' },
                                contributorEmail: { stringValue: k.contributorEmail || '' },
                                enabled: { booleanValue: k.enabled !== false },
                                createdAt: { stringValue: k.createdAt || new Date().toISOString() }
                            }
                        }
                    }))
                }
            },
            updatedAt: { stringValue: new Date().toISOString() },
            version: { integerValue: "1" }
        }
    };
}

/**
 * Parses StoredKey[] from Firestore REST single document APIkeys response
 */
function parseFirestoreApiKeysDoc(data: any): StoredKey[] {
    const fields = data.fields || {};
    const values = fields.keys?.arrayValue?.values || [];
    const items: StoredKey[] = [];

    for (const val of values) {
        const f = val.mapValue?.fields || {};
        const id = f.id?.stringValue || crypto.randomUUID();
        const label = f.label?.stringValue || 'Central Key';
        const encryptedKey = f.encryptedKey?.stringValue || '';
        const maskedKey = f.maskedKey?.stringValue || '••••••••';
        const keyHash = f.keyHash?.stringValue || '';
        const contributedBy = f.contributedBy?.stringValue || '';
        const contributorEmail = f.contributorEmail?.stringValue || '';
        const enabled = f.enabled?.booleanValue !== false;
        const createdAt = f.createdAt?.stringValue || new Date().toISOString();

        if (encryptedKey) {
            items.push({
                id,
                label,
                encryptedKey,
                maskedKey,
                keyHash,
                enabled,
                createdAt,
                contributedBy,
                contributorEmail
            });
        }
    }
    return items;
}

/**
 * Writes StoredKey[] array to single central_keys/APIkeys document in Firestore
 */
async function saveApiKeysDocumentToFirestore(keys: StoredKey[]): Promise<boolean> {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';

    if (!projectId) return false;

    try {
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/central_keys/APIkeys${apiKey ? `?key=${apiKey}` : ''}`;
        const docBody = keysToFirestoreDocFields(keys);

        const resp = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(docBody)
        });

        if (!resp.ok) {
            console.warn(`[Server] Firestore write central_keys/APIkeys status ${resp.status}`);
            return false;
        }

        keysInApiKeysDoc = keys.length;
        return true;
    } catch (err) {
        console.warn("[Server] Error writing central_keys/APIkeys document:", err);
        return false;
    }
}

/**
 * Idempotently migrates legacy central_keys/{docId} collection entries into central_keys/APIkeys
 */
async function migrateLegacyKeysToSingleDoc(projectId: string, apiKey?: string, dbId: string = '(default)'): Promise<StoredKey[]> {
    try {
        console.log('[Server] Checking legacy central_keys collection for migration...');
        const collectionUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/central_keys?pageSize=1000${apiKey ? `&key=${apiKey}` : ''}`;
        const resp = await fetch(collectionUrl);

        const keyMap = new Map<string, StoredKey>();

        // Include local file keys first
        const fileKeys = loadStoredKeys();
        for (const fk of fileKeys) {
            keyMap.set(fk.keyHash || fk.id, fk);
        }

        let legacyCount = 0;
        let dupesCount = 0;

        if (resp.ok) {
            const data = (await resp.json()) as any;
            if (data.documents && Array.isArray(data.documents)) {
                for (const doc of data.documents) {
                    const docPath = doc.name || '';
                    const docId = docPath.split('/').pop() || '';
                    if (docId === 'APIkeys') continue; // Skip single doc if present

                    legacyCount++;
                    const fields = doc.fields || {};
                    const rawKey = fields.key?.stringValue || '';
                    let encryptedKey = fields.encryptedKey?.stringValue || '';
                    const label = fields.label?.stringValue || 'Central Key';
                    const enabled = fields.enabled?.booleanValue !== false;
                    const createdAt = fields.createdAt?.stringValue || new Date().toISOString();
                    const keyHash = fields.keyHash?.stringValue || crypto.createHash('sha256').update(rawKey || encryptedKey).digest('hex');
                    const contributedBy = fields.contributedBy?.stringValue;
                    const contributorEmail = fields.contributorEmail?.stringValue;

                    if (!encryptedKey && rawKey) {
                        encryptedKey = (rawKey.includes(':') && rawKey.length > 40) ? rawKey : encrypt(rawKey);
                    }

                    if (keyMap.has(keyHash)) {
                        dupesCount++;
                    } else if (encryptedKey || rawKey) {
                        keyMap.set(keyHash, {
                            id: fields.id?.stringValue || docId,
                            label,
                            encryptedKey: encryptedKey || encrypt(rawKey),
                            keyHash,
                            enabled,
                            createdAt,
                            contributedBy,
                            contributorEmail
                        });
                    }
                }
            }
        }

        const mergedKeys = Array.from(keyMap.values());
        saveStoredKeys(mergedKeys);

        // Persist to single central_keys/APIkeys document
        const written = await saveApiKeysDocumentToFirestore(mergedKeys);
        if (written) {
            migrationStatus = 'migrated_to_single_doc';
            legacyDocsMigrated = legacyCount;
            duplicatesRemoved = dupesCount;
            keysInApiKeysDoc = mergedKeys.length;
            console.log(`[Server] Migration completed: ${legacyCount} legacy documents scanned, ${dupesCount} duplicates deduplicated, ${mergedKeys.length} keys stored in central_keys/APIkeys.`);
        }

        return mergedKeys;
    } catch (err) {
        console.error('[Server] Error during legacy central_keys migration:', err);
        return loadStoredKeys();
    }
}

/**
 * Single-document loader for central_keys/APIkeys
 * Performs exactly 1 Firestore document read on cold cache.
 */
async function fetchKeysFromFirestore(): Promise<StoredKey[] | null> {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';

    if (!projectId) {
        return null;
    }

    try {
        const singleDocUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/central_keys/APIkeys${apiKey ? `?key=${apiKey}` : ''}`;
        const resp = await fetch(singleDocUrl);

        if (resp.ok) {
            const data = (await resp.json()) as any;
            const keys = parseFirestoreApiKeysDoc(data);
            keysInApiKeysDoc = keys.length;
            migrationStatus = 'single_doc_active';
            console.log(`[Server] Single document read: central_keys/APIkeys retrieved (${keys.length} keys, 1 Firestore read).`);
            return keys;
        }

        if (resp.status === 404) {
            console.log('[Server] central_keys/APIkeys document missing. Executing idempotent single-doc migration...');
            return await migrateLegacyKeysToSingleDoc(projectId, apiKey, dbId);
        }

        console.warn(`[Server] Firestore GET APIkeys document status ${resp.status}`);
        return null;
    } catch (err) {
        console.warn("[Server] Notice fetching central_keys/APIkeys document:", err);
        return null;
    }
}

/**
 * Server-side centralized key registry synchronizer with concurrency lock & cache versioning
 */
async function syncCentralKeys(forceRefresh = false): Promise<{ id: string; key: string }[]> {
    const now = Date.now();
    const isCacheValid = !forceRefresh && 
                         cachedVersion === centralKeyCacheVersion && 
                         centralKeyCache.length > 0 && 
                         (now - centralKeyCacheTimestamp < CACHE_TTL_MS);

    if (isCacheValid) {
        centralCacheHits++;
        return centralKeyCache;
    }

    // In-flight refresh lock: concurrent requests await the exact same promise
    if (centralKeyRefreshPromise) {
        return await centralKeyRefreshPromise;
    }

    centralCacheMisses++;

    centralKeyRefreshPromise = (async () => {
        centralCacheRefreshes++;
        try {
            console.log(`[Server] Performing controlled Central API registry refresh (v${centralKeyCacheVersion}, forceRefresh=${forceRefresh})...`);
            
            // 1. Fetch from local file storage
            const fileKeys = loadStoredKeys();

            // 2. Try fetching from Firestore (if configured & allowed)
            const firestoreKeys = await fetchKeysFromFirestore();

            // Merge unique by keyHash
            const keyMap = new Map<string, StoredKey>();
            for (const fk of fileKeys) {
                keyMap.set(fk.keyHash || fk.id, fk);
            }
            if (firestoreKeys !== null && Array.isArray(firestoreKeys)) {
                for (const fsk of firestoreKeys) {
                    keyMap.set(fsk.keyHash || fsk.id, fsk);
                }
            }

            const allStored = Array.from(keyMap.values());
            if (allStored.length > 0) {
                saveStoredKeys(allStored);
            }

            const active = allStored.filter(k => k.enabled).map(data => {
                let decryptedKey = '';
                try {
                    decryptedKey = decrypt(data.encryptedKey);
                } catch (e) {
                    if (data.encryptedKey && data.encryptedKey.startsWith('AIza')) {
                        decryptedKey = data.encryptedKey;
                    }
                }
                return { id: data.id, key: decryptedKey };
            }).filter(k => k.key.length > 0);

            centralKeyCache = active;
            centralKeys = active;
            cachedVersion = centralKeyCacheVersion;
            centralKeyCacheTimestamp = Date.now();
            console.log(`[Server] Central API key registry active count: ${centralKeyCache.length} nodes (version v${cachedVersion})`);
            return centralKeyCache;
        } catch (error) {
            centralCacheRefreshFailures++;
            console.error("[Server] Error in syncCentralKeys:", error);
            if (centralKeyCache.length > 0) {
                return centralKeyCache;
            }
            return [];
        } finally {
            centralKeyRefreshPromise = null;
        }
    })();

    return await centralKeyRefreshPromise;
}

function invalidateCentralCache() {
    centralKeyCacheVersion++;
    centralKeyCacheTimestamp = 0;
    centralCacheInvalidations++;
    console.log(`[Server] Central API registry cache invalidated. New version: v${centralKeyCacheVersion}`);
}

async function startServer() {
    await syncCentralKeys(); // Initial sync

    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    // Helper to map a virtual key ID like 'central-5' to a real key
    async function getRealKey(virtualKeyId: string): Promise<string> {
        await syncCentralKeys();
        if (centralKeys.length > 0) {
            let index = 0;
            if (virtualKeyId && virtualKeyId.startsWith('central-')) {
                const num = parseInt(virtualKeyId.split('-')[1], 10);
                if (!isNaN(num)) index = num;
            }
            return centralKeys[index % centralKeys.length].key;
        }
        if (process.env.GEMINI_API_KEY) {
            return process.env.GEMINI_API_KEY;
        }
        throw new Error("No Central API keys available in pool. Please contribute an API key or switch to Local API mode.");
    }

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
            const force = req.query.refresh === 'true';
            if (force) {
                invalidateCentralCache();
            }
            await syncCentralKeys(force);

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
            res.status(500).json({ success: false, error: "Failed to fetch central keys", keys: [] });
        }
    });

    app.post("/api/central-generate", async (req, res) => {
        try {
            const { items, config, virtualKeyId, localKeys, isAdmin, hasExplicitAdminGrant } = req.body;
            
            // Central API Eligibility Check
            let isEligible = false;
            if (centralKeys.length > 0 || process.env.GEMINI_API_KEY) {
                isEligible = true;
            } else if (isAdmin || hasExplicitAdminGrant) {
                isEligible = true;
            } else if (Array.isArray(localKeys)) {
                const uniqueKeys = new Set(localKeys.map((k: string) => k.trim()).filter(k => k.startsWith('AIza') && k.length > 20));
                if (uniqueKeys.size >= 8) {
                    isEligible = true;
                }
            }
            if (!isEligible) {
                throw new Error("Central API access requires active central pool keys or Administrator approval.");
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
                model: config.model,
                contents: { parts: promptParts },
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
            res.status(500).send(error.message || "Internal Server Error");
        }
    });

    app.post("/api/central-category", async (req, res) => {
        try {
            const { items, model, virtualKeyId, localKeys, isAdmin, hasExplicitAdminGrant } = req.body;
            
            // Central API Eligibility Check
            let isEligible = false;
            if (centralKeys.length > 0 || process.env.GEMINI_API_KEY) {
                isEligible = true;
            } else if (isAdmin || hasExplicitAdminGrant) {
                isEligible = true;
            } else if (Array.isArray(localKeys)) {
                const uniqueKeys = new Set(localKeys.map((k: string) => k.trim()).filter(k => k.startsWith('AIza') && k.length > 20));
                if (uniqueKeys.size >= 8) {
                    isEligible = true;
                }
            }
            if (!isEligible) {
                throw new Error("Central API access requires active central pool keys or Administrator approval.");
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
                model: model,
                contents: { parts: promptParts },
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
            res.status(500).send(error.message || "Internal Server Error");
        }
    });

    // Endpoint for users to automatically contribute keys to the central pool
    app.post("/api/collect-keys", async (req, res) => {
        try {
            const { keys, contributedBy, contributorEmail } = req.body;
            if (!Array.isArray(keys)) return res.status(400).send("Expected array of keys");

            const result = await runWithKeyMutationLock(async () => {
                let added = 0;
                const storedKeys = loadStoredKeys();
                
                for (const k of keys) {
                    if (!k.key || typeof k.key !== 'string' || k.key.trim().length < 15) continue;
                    
                    const keyHash = crypto.createHash('sha256').update(k.key.trim()).digest('hex');
                    
                    const existing = storedKeys.find(sk => sk.keyHash === keyHash);
                    if (existing) continue; // Skip duplicate

                    const encryptedKey = encrypt(k.key.trim());
                    storedKeys.push({
                        id: crypto.randomUUID(),
                        label: k.label || 'User Contributed Key',
                        encryptedKey,
                        keyHash,
                        enabled: true,
                        createdAt: new Date().toISOString(),
                        contributedBy: contributedBy || k.contributedBy || 'user',
                        contributorEmail: contributorEmail || k.contributorEmail || ''
                    });
                    added++;
                }
                if (added > 0) {
                    saveStoredKeys(storedKeys);
                    await saveApiKeysDocumentToFirestore(storedKeys);
                    invalidateCentralCache();
                }
                return { added, total: storedKeys.filter(k => k.enabled).length };
            });

            res.json({ success: true, added: result.added, total: result.total });
        } catch (e: any) {
            console.error("Error collecting keys:", e);
            res.status(500).send(e.message);
        }
    });

    // Telemetry & Diagnostics Endpoint
    app.get("/api/admin/cache-telemetry", (req, res) => {
        const storedKeys = loadStoredKeys();
        const docObj = keysToFirestoreDocFields(storedKeys);
        const docJson = JSON.stringify(docObj);
        const docSizeBytes = Buffer.byteLength(docJson, 'utf8');
        const maxDocSizeBytes = 1048576; // 1 MB limit
        const docCapacityUsedPercent = Number(((docSizeBytes / maxDocSizeBytes) * 100).toFixed(2));
        const avgKeySize = storedKeys.length > 0 ? Math.round(docSizeBytes / storedKeys.length) : 350;
        const remainingBytes = Math.max(0, maxDocSizeBytes - docSizeBytes);
        const estimatedRemainingKeys = Math.floor(remainingBytes / (avgKeySize || 350));

        res.json({
            hits: centralCacheHits,
            misses: centralCacheMisses,
            refreshes: centralCacheRefreshes,
            invalidations: centralCacheInvalidations,
            refreshFailures: centralCacheRefreshFailures,
            cacheVersion: centralKeyCacheVersion,
            cachedVersion: cachedVersion,
            cacheSize: centralKeyCache.length,
            cacheAgeMs: centralKeyCacheTimestamp ? Date.now() - centralKeyCacheTimestamp : null,
            refreshInFlight: !!centralKeyRefreshPromise,
            migrationStatus,
            legacyDocsMigrated,
            duplicatesRemoved,
            keysInApiKeysDoc: storedKeys.length,
            docSizeBytes,
            maxDocSizeBytes,
            docCapacityUsedPercent,
            sizeWarning: docCapacityUsedPercent >= 80,
            estimatedRemainingKeys
        });
    });

    // Admin endpoints to manage Central Keys
    app.post("/api/admin/keys", async (req, res) => {
        try {
            const { label, key, contributedBy, contributorEmail } = req.body;
            if (!label || !key) return res.status(400).send("Label and key required");

            const newKey = await runWithKeyMutationLock(async () => {
                const encryptedKey = encrypt(key.trim());
                const keyHash = crypto.createHash('sha256').update(key.trim()).digest('hex');
                
                const storedKeys = loadStoredKeys();
                const existing = storedKeys.find(sk => sk.keyHash === keyHash);
                if (existing) {
                    throw new Error("Key already exists in the central pool");
                }

                const created = {
                    id: crypto.randomUUID(),
                    label: label.trim(),
                    encryptedKey,
                    keyHash,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    contributedBy: contributedBy || 'admin',
                    contributorEmail: contributorEmail || ''
                };
                storedKeys.push(created);
                saveStoredKeys(storedKeys);
                await saveApiKeysDocumentToFirestore(storedKeys);
                
                invalidateCentralCache();
                return created;
            });
            
            res.json({ id: newKey.id, label: newKey.label, enabled: true });
        } catch (e: any) {
            res.status(400).send(e.message || "Failed to add central key");
        }
    });

    app.post("/api/admin/keys/refresh", async (req, res) => {
        try {
            invalidateCentralCache();
            await syncCentralKeys(true);
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

                return {
                    id: data.id,
                    label: data.label,
                    maskedKey,
                    enabled: data.enabled,
                    createdAt: data.createdAt,
                    contributedBy: data.contributedBy,
                    contributorEmail: data.contributorEmail
                };
            });
            res.json({ success: true, keys, count: keys.length });
        } catch (e: any) {
            res.status(500).send(e.message);
        }
    });

    app.get("/api/admin/keys", async (req, res) => {
        try {
            const force = req.query.refresh === 'true';
            if (force) {
                invalidateCentralCache();
                await syncCentralKeys(true);
            }
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

                return {
                    id: data.id,
                    label: data.label,
                    maskedKey,
                    enabled: data.enabled,
                    createdAt: data.createdAt,
                    contributedBy: data.contributedBy,
                    contributorEmail: data.contributorEmail
                };
            });
            res.json(keys);
        } catch (e: any) {
            res.status(500).send(e.message);
        }
    });

    app.delete("/api/admin/keys/:id", async (req, res) => {
        try {
            await runWithKeyMutationLock(async () => {
                let storedKeys = loadStoredKeys();
                storedKeys = storedKeys.filter(k => k.id !== req.params.id);
                saveStoredKeys(storedKeys);
                await saveApiKeysDocumentToFirestore(storedKeys);
                invalidateCentralCache();
            });
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).send(e.message);
        }
    });

    app.patch("/api/admin/keys/:id", async (req, res) => {
        try {
            const { enabled } = req.body;
            await runWithKeyMutationLock(async () => {
                const storedKeys = loadStoredKeys();
                const key = storedKeys.find(k => k.id === req.params.id);
                if (key) {
                    key.enabled = enabled;
                    saveStoredKeys(storedKeys);
                    await saveApiKeysDocumentToFirestore(storedKeys);
                    invalidateCentralCache();
                }
            });
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).send(e.message);
        }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*all', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
}

startServer();
