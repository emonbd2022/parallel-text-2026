import express from 'express';
import cors from 'cors';
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
    if (!text) return '';
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
export interface StoredKey {
    id: string;
    label: string;
    encryptedKey: string;
    keyHash: string;
    enabled: boolean;
    createdAt: string;
    contributedBy?: string;
    contributorName?: string;
    contributorEmail?: string;
    status?: 'active' | 'dead' | 'untested' | 'disabled';
    isDead?: boolean;
    deadReason?: string;
    lastTestedAt?: string;
}

let centralKeys: { id: string; key: string }[] = [];
let cachedFirestoreStoredKeys: StoredKey[] | null = null;
let lastCentralKeysFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL
let centralKeyRefreshPromise: Promise<{ id: string; key: string }[]> | null = null;

let cachedSettings: { centralModeEnabled: boolean } | null = null;
let lastSettingsFetchTime = 0;
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
let settingsRefreshPromise: Promise<{ centralModeEnabled: boolean }> | null = null;

const USAGE_DATA_FILE = path.join(process.cwd(), 'central-usage.json');

interface UserDailyUsage {
    cycleId: string;
    usedRequests: number;
    lastUpdated: number;
}

// Map of userId/email/ip -> UserDailyUsage
const userDailyUsageMap = new Map<string, UserDailyUsage>();

function loadDailyUsage(): void {
    try {
        if (fs.existsSync(USAGE_DATA_FILE)) {
            const raw = fs.readFileSync(USAGE_DATA_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                const currentCycle = getBangladeshDailyCycleId();
                for (const [key, val] of Object.entries(parsed)) {
                    const item = val as any;
                    if (item && item.cycleId === currentCycle && typeof item.usedRequests === 'number') {
                        userDailyUsageMap.set(key, {
                            cycleId: item.cycleId,
                            usedRequests: item.usedRequests,
                            lastUpdated: item.lastUpdated || Date.now()
                        });
                    }
                }
            }
        }
    } catch (e) {
        // Safe fallback
    }
}

let saveUsageTimeout: NodeJS.Timeout | null = null;
function saveDailyUsageDebounced(): void {
    if (saveUsageTimeout) clearTimeout(saveUsageTimeout);
    saveUsageTimeout = setTimeout(() => {
        try {
            if (isProductionEnv() && !!process.env.VERCEL) return;
            const obj: Record<string, UserDailyUsage> = {};
            for (const [k, v] of userDailyUsageMap.entries()) {
                obj[k] = v;
            }
            fs.writeFileSync(USAGE_DATA_FILE, JSON.stringify(obj, null, 2));
        } catch (e) {
            // Ignore on read-only environments
        }
    }, 1000);
}

/**
 * Bangladesh Time is GMT+6.
 * Authoritative Central API cycle resets every day at 2:00 PM BST (14:00 BST = 08:00 UTC).
 * Any timestamp between 08:00:00 UTC Day D and 07:59:59.999 UTC Day D+1 belongs to the same daily cycle.
 */
export function getBangladeshDailyCycleId(timestampMs = Date.now()): string {
    const shifted = new Date(timestampMs - 8 * 60 * 60 * 1000);
    const year = shifted.getUTCFullYear();
    const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getNextResetTimestamp(timestampMs = Date.now()): number {
    const now = new Date(timestampMs);
    const todayReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0, 0));
    if (now.getTime() < todayReset.getTime()) {
        return todayReset.getTime();
    }
    return todayReset.getTime() + 24 * 60 * 60 * 1000;
}

const isProductionEnv = () => {
    return process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
};

const isDevSeedEnabled = () => {
    return process.env.ENABLE_DEV_CENTRAL_KEYS === 'true' && !isProductionEnv();
};

/**
 * Deduplicates API keys strictly by their decrypted plaintext value.
 * If two keys have the same API key value, exactly one is preserved regardless of label or ID.
 */
export function deduplicateKeysByValue(keys: StoredKey[]): StoredKey[] {
    const seenValues = new Set<string>();
    const deduplicated: StoredKey[] = [];

    for (const item of keys) {
        let plaintextKey = '';
        try {
            plaintextKey = decrypt(item.encryptedKey) || (item as any).key || '';
        } catch {
            plaintextKey = (item as any).key || item.encryptedKey || '';
        }
        const cleanVal = (plaintextKey || '').trim();
        if (!cleanVal || cleanVal.length < 10) continue;

        if (seenValues.has(cleanVal)) {
            // Duplicate API key value found - remove duplicate
            continue;
        }
        seenValues.add(cleanVal);
        deduplicated.push(item);
    }
    return deduplicated;
}

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
                    return deduplicateKeysByValue(parsed);
                }
            }
        }
    } catch (e) {
        // Safe read failure fallback
    }

    return [];
}

function saveStoredKeys(keys: StoredKey[]) {
    try {
        if (isProductionEnv() && !!process.env.VERCEL) {
            // Do not attempt to write to local filesystem on Vercel
            return;
        }
        fs.writeFileSync(DATA_FILE, JSON.stringify(keys, null, 2));
    } catch (e) {
        // Safe ignore on read-only environments
    }
}

// Initialize in-memory keys and usage from persistent disk immediately on server boot
try {
    const initialDiskKeys = loadStoredKeys();
    if (initialDiskKeys.length > 0) {
        centralKeys = initialDiskKeys.filter(k => k.enabled !== false && !k.isDead && k.status !== 'dead').map(data => {
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
        console.log(`[Server Boot] Loaded ${centralKeys.length} central API keys from persistent central-keys.json.`);
    }
    loadDailyUsage();
} catch (e) {
    console.error("[Server Boot] Init error:", e);
}

function getFirestoreDbCandidates(): string[] {
    const candidates = new Set<string>();
    const envDb = (process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || '').trim();
    if (envDb) {
        candidates.add(envDb);
    }
    candidates.add('default');
    candidates.add('(default)');
    return Array.from(candidates);
}

/**
 * Fetches central keys from Firestore single document central_keys/APIkeys via REST API
 * Cached with CACHE_TTL_MS to eliminate redundant Firestore reads.
 */
async function fetchKeysFromFirestore(idToken?: string, forceRefresh = false): Promise<StoredKey[] | null> {
    const now = Date.now();
    if (!forceRefresh && cachedFirestoreStoredKeys !== null && (now - lastCentralKeysFetchTime < CACHE_TTL_MS)) {
        return cachedFirestoreStoredKeys;
    }

    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;

    if (!projectId) {
        return cachedFirestoreStoredKeys;
    }

    const dbCandidates = getFirestoreDbCandidates();

    for (const dbId of dbCandidates) {
        try {
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/central_keys/APIkeys${apiKey ? `?key=${apiKey}` : ''}`;
            const headers: Record<string, string> = {};
            if (idToken) {
                headers['Authorization'] = `Bearer ${idToken}`;
            }
            
            const resp = await fetch(url, { headers });
            if (!resp.ok) {
                const errText = await resp.text();
                if (errText.includes('does not exist for project') || (errText.includes('NOT_FOUND') && errText.includes('databases/'))) {
                    // Database candidate does not exist in project; try next candidate
                    continue;
                }
                if (resp.status === 404) {
                    // Valid database found, but doc doesn't exist -> strictly 0 keys
                    cachedFirestoreStoredKeys = [];
                    lastCentralKeysFetchTime = Date.now();
                    return [];
                }
                if (resp.status === 403 && !idToken) {
                    // Unauthenticated server-side probe on protected collection
                    return cachedFirestoreStoredKeys;
                }
                console.log(`[Server] Firestore REST fetch (${dbId}) status ${resp.status}`);
                continue;
            }
            const data = (await resp.json()) as any;
            const fields = data.fields || {};
            const rawKeysArray = fields.keys?.arrayValue?.values || [];

            if (rawKeysArray.length === 0) {
                // Authoritative document contains 0 keys
                cachedFirestoreStoredKeys = [];
                lastCentralKeysFetchTime = Date.now();
                return [];
            }

            const items: StoredKey[] = [];
            for (const item of rawKeysArray) {
                const kf = item.mapValue?.fields || {};
                const id = kf.id?.stringValue || crypto.randomUUID();
                const label = kf.label?.stringValue || 'Central Key';
                const rawKey = kf.key?.stringValue || '';
                let encryptedKey = kf.encryptedKey?.stringValue || '';
                const keyHash = kf.keyHash?.stringValue || '';
                const enabled = kf.enabled?.booleanValue !== false;
                const status = kf.status?.stringValue || (kf.isDead?.booleanValue ? 'dead' : (enabled ? 'active' : 'disabled'));
                const isDead = kf.isDead?.booleanValue || status === 'dead';
                const deadReason = kf.deadReason?.stringValue || '';
                const lastTestedAt = kf.lastTestedAt?.stringValue || '';
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
                        enabled: isDead ? false : enabled,
                        status: (isDead ? 'dead' : (enabled ? 'active' : 'disabled')) as any,
                        isDead,
                        deadReason,
                        lastTestedAt,
                        createdAt,
                        contributedBy,
                        contributorName,
                        contributorEmail
                    });
                }
            }
            const deduplicated = deduplicateKeysByValue(items);
            cachedFirestoreStoredKeys = deduplicated;
            lastCentralKeysFetchTime = Date.now();
            return deduplicated;
        } catch (err) {
            console.log(`[Server] Notice fetching Firestore (${dbId}):`, err);
        }
    }
    return cachedFirestoreStoredKeys;
}

// In-memory mutex for Central Keys modification to prevent race conditions (overwriting)
let centralKeysLock = Promise.resolve();

async function withCentralKeysLock<T>(task: () => Promise<T>): Promise<T> {
    let releaseLock!: () => void;
    const nextLock = new Promise<void>((resolve) => {
        releaseLock = resolve;
    });
    
    const previousLock = centralKeysLock;
    centralKeysLock = nextLock;

    try {
        await previousLock;
        return await task();
    } finally {
        releaseLock();
    }
}

/**
 * Saves all central keys to the single Firestore document central_keys/APIkeys
 */
async function saveKeysToFirestoreDocument(keys: StoredKey[], idToken?: string): Promise<boolean> {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;

    if (!projectId) return false;

    const deduplicatedKeys = deduplicateKeysByValue(keys);
    const dbCandidates = getFirestoreDbCandidates();

    const values = deduplicatedKeys.map(k => ({
        mapValue: {
            fields: {
                id: { stringValue: k.id || crypto.randomUUID() },
                label: { stringValue: k.label || 'Central Key' },
                encryptedKey: { stringValue: k.encryptedKey || '' },
                keyHash: { stringValue: k.keyHash || '' },
                enabled: { booleanValue: k.enabled !== false && !k.isDead && k.status !== 'dead' },
                createdAt: { stringValue: k.createdAt || new Date().toISOString() },
                contributedBy: { stringValue: k.contributedBy || 'central' },
                contributorName: { stringValue: k.contributorName || 'User' },
                contributorEmail: { stringValue: k.contributorEmail || '' },
                status: { stringValue: k.status || (k.isDead ? 'dead' : (k.enabled === false ? 'disabled' : 'active')) },
                isDead: { booleanValue: Boolean(k.isDead || k.status === 'dead') },
                deadReason: { stringValue: k.deadReason || '' },
                lastTestedAt: { stringValue: k.lastTestedAt || '' }
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
            totalCount: { integerValue: deduplicatedKeys.length.toString() },
            updatedAt: { stringValue: new Date().toISOString() }
        }
    };

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
    }

    for (const dbId of dbCandidates) {
        try {
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/central_keys/APIkeys${apiKey ? `?key=${apiKey}` : ''}`;
            const resp = await fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(body)
            });

            if (resp.ok) {
                console.log(`[Firestore Write: 1] Successfully saved ${deduplicatedKeys.length} central keys to central_keys/APIkeys document (database: ${dbId}).`);
                cachedFirestoreStoredKeys = deduplicatedKeys;
                lastCentralKeysFetchTime = Date.now();
                return true;
            } else {
                const errText = await resp.text();
                if (errText.includes('does not exist for project') || (errText.includes('NOT_FOUND') && errText.includes('databases/'))) {
                    continue;
                }
                console.warn(`[Firestore Write Failed] Status ${resp.status} (${dbId}):`, errText);
            }
        } catch (e) {
            console.error(`[Server] Error saving central_keys/APIkeys to Firestore (${dbId}):`, e);
        }
    }

    return false;
}

/**
 * Server-side centralized key registry synchronizer with concurrency lock.
 * Strict Authoritative Rules:
 * 1. If Firestore central_keys/APIkeys returns 0 keys or does not exist, Central API registry has 0 keys.
 * 2. In production, NEVER fall back to hardcoded/seed keys.
 * 3. Server memory cache is cleared when authoritative registry is empty.
 * 4. Duplicate keys (same API key value) are identified and deduplicated.
 */
async function syncCentralKeys(forceRefresh = false, idToken?: string): Promise<{ id: string; key: string }[]> {
    const now = Date.now();
    // Return warm cache if valid
    if (!forceRefresh && (now - lastCentralKeysFetchTime < CACHE_TTL_MS) && cachedFirestoreStoredKeys !== null) {
        return centralKeys;
    }

    // In-flight refresh lock: concurrent requests await the exact same promise
    if (centralKeyRefreshPromise) {
        return await centralKeyRefreshPromise;
    }

    centralKeyRefreshPromise = (async () => {
        try {
            console.log(`[Server] Performing Central API registry sync (forceRefresh=${forceRefresh})...`);
            const diskKeys = loadStoredKeys();
            
            // 1. Fetch from authoritative Firestore registry document (with single read caching)
            const firestoreKeys = await fetchKeysFromFirestore(idToken, forceRefresh);

            // If Firestore answered with an authoritative document
            if (firestoreKeys !== null) {
                if (firestoreKeys.length === 0) {
                    console.log(`[Server] Authoritative Central API registry is empty: 0 keys available.`);
                    centralKeys = [];
                    cachedFirestoreStoredKeys = [];
                    lastCentralKeysFetchTime = Date.now();
                    
                    if (isDevSeedEnabled() && diskKeys.length > 0) {
                        console.log(`[Server] Development mode: Loading ${diskKeys.length} persistent disk keys into memory (NOT saving to Firestore).`);
                        const active = diskKeys.filter(k => k.enabled !== false && !k.isDead && k.status !== 'dead').map(data => {
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
                        cachedFirestoreStoredKeys = diskKeys;
                    }
                    return centralKeys;
                }

                // Authoritative registry has keys -> use them directly. DO NOT merge with diskKeys or sync back to Firestore on startup!
                // We just keep our local cache in sync with Firestore.
                const deduplicated = deduplicateKeysByValue(firestoreKeys);
                saveStoredKeys(deduplicated);

                const active = deduplicated.filter(k => k.enabled !== false && !k.isDead && k.status !== 'dead').map(data => {
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
                cachedFirestoreStoredKeys = deduplicated;
                lastCentralKeysFetchTime = Date.now();
                console.log(`[Server] Central API key registry active count: ${centralKeys.length} nodes (Firestore authoritative)`);
                return centralKeys;
            }

            // If Firestore fetch was null (e.g. unauthenticated probe or network glitch)
            lastCentralKeysFetchTime = Date.now();

            if (diskKeys.length > 0) {
                const active = diskKeys.filter(k => k.enabled !== false && !k.isDead && k.status !== 'dead').map(data => {
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
                return centralKeys;
            }

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
    cachedFirestoreStoredKeys = null;
    console.log('[Server] Central API registry cache invalidated (event-driven).');
}

/**
 * Authoritative Identity Resolver for Usage Tracking
 */

async function verifyUserDevice(idToken: string | undefined, deviceId: string | undefined, uid: string): Promise<boolean> {
    if (!uid || !idToken || !deviceId) return false;
    
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    if (!projectId) return true;
    
    const dbCandidates = getFirestoreDbCandidates();

    for (const dbId of dbCandidates) {
        try {
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/users/${uid}`;
            const headers: Record<string, string> = { 'Authorization': `Bearer ${idToken}` };
            const resp = await fetch(url, { headers });
            if (!resp.ok) {
                const errText = await resp.text();
                if (errText.includes('does not exist for project') || (errText.includes('NOT_FOUND') && errText.includes('databases/'))) {
                    continue;
                }
                return false;
            }
            
            const data = await resp.json();
            const fields = data.fields || {};
            const deviceIds = fields.deviceIds?.arrayValue?.values?.map((v: any) => v.stringValue) || [];
            return deviceIds.includes(deviceId);
        } catch (e) {
            console.error(`verifyUserDevice error (${dbId}):`, e);
        }
    }
    return false;
}

function getUserIdentity(req: express.Request, bodyUser?: any): { id: string; email?: string; isAdmin: boolean } {
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
    let email = bodyUser?.email || '';
    let uid = bodyUser?.uid || '';
    let isAdmin = false;

    if (idToken) {
        try {
            const parts = idToken.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                if (payload.email) email = payload.email;
                if (payload.user_id || payload.sub) uid = payload.user_id || payload.sub;
                if (payload.email === 'titaniumfact97@gmail.com' || payload.email === 'reactoremon2022@gmail.com' || payload.role === 'admin' || payload.admin === true) {
                    isAdmin = true;
                }
            }
        } catch {}
    }

    if (bodyUser?.isAdmin || bodyUser?.role === 'admin' || bodyUser?.role === 'superadmin' || email === 'titaniumfact97@gmail.com' || email === 'reactoremon2022@gmail.com') {
        isAdmin = true;
    }

    const id = uid || email || (req.ip ? `ip_${req.ip}` : 'anonymous_user');
    return { id, email, isAdmin };
}

/**
 * Calculates user Central API allowance based on local API keys:
 * RULE:
 * 1 Local API Key = 100 Central API requests / 50 Images per day
 * Formula:
 * Daily Central Requests = Local API Key Count × 100
 * Daily Central Images = Local API Key Count × 50
 */
function getUserCentralLimit(localKeys: any[], isAdmin: boolean): { localKeyCount: number; maxRequests: number; maxImages: number } {
    let localKeyCount = 0;
    if (Array.isArray(localKeys)) {
        const rawKeyList = localKeys.map((k: any) => typeof k === 'string' ? k.trim() : (typeof k?.key === 'string' ? k.key.trim() : '')).filter(Boolean);
        const uniqueKeys = new Set(rawKeyList.filter(k => (k.startsWith('AIza') || k.startsWith('AQ.')) && k.length > 20));
        localKeyCount = uniqueKeys.size;
    }

    if (isAdmin) {
        const maxReqs = Math.max(50000, localKeyCount * 100);
        return { localKeyCount, maxRequests: maxReqs, maxImages: Math.floor(maxReqs / 2) };
    }

    const maxRequests = localKeyCount * 100;
    const maxImages = localKeyCount * 50;
    return { localKeyCount, maxRequests, maxImages };
}

/**
 * Authoritatively verifies if user has quota available for this request
 */
function checkUserQuota(userId: string, localKeys: any[], isAdmin: boolean, requestsToConsume = 1) {
    const cycleId = getBangladeshDailyCycleId();
    const nextResetMs = getNextResetTimestamp();
    const resetTime = new Date(nextResetMs).toISOString();
    const { localKeyCount, maxRequests, maxImages } = getUserCentralLimit(localKeys, isAdmin);

    let usage = userDailyUsageMap.get(userId);
    if (!usage || usage.cycleId !== cycleId) {
        usage = { cycleId, usedRequests: 0, lastUpdated: Date.now() };
        userDailyUsageMap.set(userId, usage);
    }

    const usedRequests = usage.usedRequests;
    const remainingRequests = Math.max(0, maxRequests - usedRequests);
    const remainingImages = Math.floor(remainingRequests / 2);
    const allowed = maxRequests > 0 && (usedRequests + requestsToConsume <= maxRequests);

    return {
        allowed,
        cycleId,
        usedRequests,
        totalRequests: maxRequests,
        remainingRequests,
        localKeyCount,
        totalImages: maxImages,
        remainingImages,
        isLimitReached: usedRequests >= maxRequests,
        resetTime,
        nextResetMs
    };
}

function recordUserUsage(userId: string, requestsConsumed = 1) {
    const cycleId = getBangladeshDailyCycleId();
    let usage = userDailyUsageMap.get(userId);
    if (!usage || usage.cycleId !== cycleId) {
        usage = { cycleId, usedRequests: 0, lastUpdated: Date.now() };
    }
    usage.usedRequests += requestsConsumed;
    usage.lastUpdated = Date.now();
    userDailyUsageMap.set(userId, usage);
    saveDailyUsageDebounced();
}

export const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to map a virtual key ID like 'central-5' or a UUID to a real key in server memory
async function getRealKey(virtualKeyId: string): Promise<string> {
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
    throw new Error("No Central API keys available in server pool. The authoritative registry contains zero keys.");
}

// Router to handle all Central API endpoints
const apiRouter = express.Router();

// Capacity endpoint for client
apiRouter.get("/central-keys-capacity", async (req, res) => {
    const settings = await fetchSettingsFromFirestore();
    const stored = loadStoredKeys();
    const fallbackCount = process.env.GEMINI_API_KEY ? 1 : 0;
    const totalActive = centralKeys.length > 0 ? centralKeys.length : fallbackCount;
    res.json({ 
        centralModeEnabled: settings.centralModeEnabled,
        capacity: totalActive,
        activeCount: centralKeys.length,
        totalCount: stored.length,
        hasFallback: !!process.env.GEMINI_API_KEY
    });
});

async function fetchSettingsFromFirestore(forceRefresh = false): Promise<{ centralModeEnabled: boolean }> {
    const now = Date.now();
    if (!forceRefresh && cachedSettings !== null && (now - lastSettingsFetchTime < SETTINGS_CACHE_TTL_MS)) {
        return cachedSettings;
    }

    if (settingsRefreshPromise) {
        return await settingsRefreshPromise;
    }

    settingsRefreshPromise = (async () => {
        const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
        const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
        const dbId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';
        let settings = cachedSettings || { centralModeEnabled: true };
        if (!projectId) return settings;
        try {
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/settings/general${apiKey ? `?key=${apiKey}` : ''}`;
            const resp = await fetch(url);
            if (resp.ok) {
                const data = await resp.json();
                const fields = data.fields || {};
                if (fields.centralModeEnabled && fields.centralModeEnabled.booleanValue !== undefined) {
                    settings = { centralModeEnabled: fields.centralModeEnabled.booleanValue };
                }
                cachedSettings = settings;
                lastSettingsFetchTime = Date.now();
            }
        } catch (e) {
            // Safe fallback
        } finally {
            settingsRefreshPromise = null;
        }
        return settings;
    })();

    return await settingsRefreshPromise;
}

// 1-Read Central API Keys Pool for Runtime Client Processing (Safe Virtual Node Handles Only)
apiRouter.get("/central-keys-pool", async (req, res) => {
    try {
        const settings = await fetchSettingsFromFirestore();
        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
        let isRequesterAdmin = false;
        if (idToken) {
            try {
                const parts = idToken.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                    if (payload.email === 'reactoremon2022@gmail.com' || payload.email === 'titaniumfact97@gmail.com' || payload.role === 'admin' || payload.admin === true) {
                        isRequesterAdmin = true;
                    }
                }
            } catch {}
        }

        if (!settings.centralModeEnabled && !isRequesterAdmin) {
            return res.status(403).json({ success: false, error: "Central Mode is disabled by administrator.", keys: [], count: 0 });
        }

        const isForce = req.query.refresh === 'true';
        await syncCentralKeys(isForce, idToken);

        let poolKeys: { id: string; label: string; key: string }[] = [];
        if (centralKeys.length > 0) {
            // Return ANONYMOUS VIRTUAL HANDLES. Real decrypted keys NEVER touch the browser.
            poolKeys = centralKeys.map((_, index) => ({
                id: `central-${index}`,
                label: `Central Pool Node ${index + 1}`,
                key: `central-${index}`
            }));
        } else if (process.env.GEMINI_API_KEY && !isProductionEnv()) {
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
        res.status(500).json({ success: false, error: "Failed to fetch central keys", keys: [], count: 0 });
    }
});

// Endpoint to securely return node handles to eligible clients
apiRouter.post("/central-keys-pool-sync", async (req, res) => {
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { localKeys, isAdmin, hasExplicitAdminGrant, forceRefresh } = body;
        const isForceRefresh = forceRefresh === true || req.query.refresh === 'true';

        const settings = await fetchSettingsFromFirestore();
        if (!settings.centralModeEnabled && !isAdmin && !hasExplicitAdminGrant) {
            return res.status(403).json({ success: false, error: "Central Mode is disabled by administrator.", keys: [], count: 0 });
        }
        
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
            if (uniqueKeys.size >= 4) {
                isEligible = true;
            }
        }

        if (!isEligible) {
            return res.status(403).json({ success: false, error: "Central API access requires at least 4 unique local API keys or Administrator approval.", keys: [], count: 0 });
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

// Endpoint to query authoritative Central API daily usage and remaining allowances
apiRouter.post("/central-usage", async (req, res) => {
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { localKeys, user, isAdmin: adminFlag } = body;
        const identity = getUserIdentity(req, user);
        const isAdmin = identity.isAdmin || adminFlag === true;

        const quota = checkUserQuota(identity.id, localKeys, isAdmin, 0);
        res.json({
            success: true,
            ...quota
        });
    } catch (e: any) {
        console.error("Error fetching central usage:", e);
        res.status(500).json({ success: false, error: String(e?.message || e) });
    }
});

apiRouter.get("/central-usage", async (req, res) => {
    try {
        const identity = getUserIdentity(req);
        const quota = checkUserQuota(identity.id, [], identity.isAdmin, 0);
        res.json({
            success: true,
            ...quota
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e?.message || e) });
    }
});

apiRouter.post("/central-generate", async (req, res) => {
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { items = [], config = {}, virtualKeyId: vId, nodeId, localKeys, isAdmin: adminFlag, hasExplicitAdminGrant, user } = body;
        const virtualKeyId = vId || nodeId;

        const identity = getUserIdentity(req, user);
        const isAdmin = identity.isAdmin || adminFlag === true || hasExplicitAdminGrant === true;

        if (!isAdmin && identity.id) {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            const deviceId = req.headers['x-device-id'] as string;
            const deviceAuthorized = await verifyUserDevice(idToken, deviceId, identity.id);
            if (!deviceAuthorized) {
                return res.status(403).json({ success: false, error: "Device Limit Reached. Contact Admin for device reset" });
            }
        }

        const settings = await fetchSettingsFromFirestore();
        if (!settings.centralModeEnabled && !isAdmin) {
            throw new Error("Central Mode is disabled by administrator.");
        }
        
        // Central API Eligibility Check
        let isEligible = false;
        if (isAdmin) {
            isEligible = true;
        } else if (Array.isArray(localKeys)) {
            const uniqueKeys = new Set(localKeys.map((k: string) => k.trim()).filter(k => (k.startsWith('AIza') || k.startsWith('AQ.')) && k.length > 20));
            if (uniqueKeys.size >= 4) {
                isEligible = true;
            }
        }
        if (!isEligible) {
            throw new Error("Central API access requires at least 4 unique local API keys or Administrator approval.");
        }

        // Authoritative Central API Daily Quota Enforcement
        const quota = checkUserQuota(identity.id, localKeys, isAdmin, 1);
        if (!quota.allowed) {
            return res.status(429).json({
                error: "DAILY_CENTRAL_LIMIT_REACHED",
                message: `Today's Central API daily limit has been reached (${quota.usedRequests}/${quota.totalRequests} requests used). Allowance resets at 2:00 PM Bangladesh Time (GMT+6).`,
                usage: quota
            });
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
            model: config.model || 'gemini-3.1-flash-lite-preview',
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
        let successfulImagesCount = 0;
        
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
                successfulImagesCount++;
            }
        });

        // REMOVED upfront deduction here. Deduction now occurs exclusively after CSV export.
        
        res.json(results);
    } catch (error: any) {
        console.error("Central API Error:", error);
        res.status(500).json({ error: String(error?.message || error) });
    }
});

apiRouter.post("/central-usage-deduct", async (req, res) => {
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { user, requestsConsumed = 0, clientUsedRequests } = body;
        const identity = getUserIdentity(req, user);
        
        // If client is sending a higher usage (because server restarted), sync it upwards before adding
        if (typeof clientUsedRequests === 'number') {
            const cycleId = getBangladeshDailyCycleId();
            let usage = userDailyUsageMap.get(identity.id);
            if (!usage || usage.cycleId !== cycleId) {
                usage = { cycleId, usedRequests: 0, lastUpdated: Date.now() };
            }
            if (clientUsedRequests > usage.usedRequests) {
                usage.usedRequests = clientUsedRequests;
                usage.lastUpdated = Date.now();
                userDailyUsageMap.set(identity.id, usage);
            }
        }

        if (requestsConsumed > 0) {
            recordUserUsage(identity.id, requestsConsumed);
        }
        
        res.json({ success: true });
    } catch (e: any) {
        console.error("Error deducting central usage:", e);
        res.status(500).json({ success: false, error: String(e?.message || e) });
    }
});

apiRouter.post("/central-category", async (req, res) => {
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { items, model, virtualKeyId: vId, nodeId, localKeys, isAdmin: adminFlag, hasExplicitAdminGrant, user } = body;
        const virtualKeyId = vId || nodeId;

        const identity = getUserIdentity(req, user);
        const isAdmin = identity.isAdmin || adminFlag === true || hasExplicitAdminGrant === true;

        if (!isAdmin && identity.id) {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            const deviceId = req.headers['x-device-id'] as string;
            const deviceAuthorized = await verifyUserDevice(idToken, deviceId, identity.id);
            if (!deviceAuthorized) {
                return res.status(403).json({ success: false, error: "Device Limit Reached. Contact Admin for device reset" });
            }
        }

        const settings = await fetchSettingsFromFirestore();
        if (!settings.centralModeEnabled && !isAdmin) {
            throw new Error("Central Mode is disabled by administrator.");
        }
        
        // Central API Eligibility Check
        let isEligible = false;
        if (isAdmin) {
            isEligible = true;
        } else if (Array.isArray(localKeys)) {
            const uniqueKeys = new Set(localKeys.map((k: string) => k.trim()).filter(k => (k.startsWith('AIza') || k.startsWith('AQ.')) && k.length > 20));
            if (uniqueKeys.size >= 4) {
                isEligible = true;
            }
        }
        if (!isEligible) {
            throw new Error("Central API access requires at least 4 unique local API keys or Administrator approval.");
        }

        // Authoritative Central API Daily Quota Enforcement
        const quota = checkUserQuota(identity.id, localKeys, isAdmin, 1);
        if (!quota.allowed) {
            return res.status(429).json({
                error: "DAILY_CENTRAL_LIMIT_REACHED",
                message: `Today's Central API daily limit has been reached (${quota.usedRequests}/${quota.totalRequests} requests used). Allowance resets at 2:00 PM Bangladesh Time (GMT+6).`,
                usage: quota
            });
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
            model: model || 'gemini-3.1-flash-lite-preview',
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

        // Usage is tracked upfront in /central-generate (1 image = 2 requests). 
        // We do not double-bill here.

        res.json(results);
    } catch (error: any) {
        console.error("Central API Error:", error);
        res.status(500).json({ error: error.message || "Internal Server Error" });
    }
});

// Endpoint for users to automatically contribute keys to the central pool
apiRouter.post("/collect-keys", async (req, res) => {
    withCentralKeysLock(async () => {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { keys } = body;
            if (!Array.isArray(keys)) return res.status(400).json({ success: false, error: "Expected array of keys" });

            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;

            let added = 0;
            let modified = false;
            let firestoreKeys = await fetchKeysFromFirestore(idToken);
            
            if (firestoreKeys === null) {
                return res.status(503).json({ success: false, error: "Database temporarily unavailable, could not safely append keys." });
            }
            
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

                // Plaintext value deduplication
                const isDuplicate = firestoreKeys.some(sk => {
                    const decrypted = decrypt(sk.encryptedKey) || (sk as any).key || '';
                    return decrypted.trim() === keyVal;
                });

                const exactContributor = (contribName || (contribBy && contribBy !== 'central' && contribBy !== 'anonymous' && contribBy !== 'Community Contributor' ? contribBy : '') || (contribEmail ? contribEmail.split('@')[0] : '') || '').trim() || 'Contributor';

                if (isDuplicate) {
                    const existing = firestoreKeys.find(sk => {
                        const decrypted = decrypt(sk.encryptedKey) || (sk as any).key || '';
                        return decrypted.trim() === keyVal;
                    });
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
                    }
                    continue; 
                }

                const encryptedKey = encrypt(keyVal);
                const keyHash = crypto.createHash('sha256').update(keyVal).digest('hex');
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

            const deduplicated = deduplicateKeysByValue(firestoreKeys);

            console.log(`📥 [Server /api/collect-keys] Processed user keys: Received: ${keys.length}, Added: +${added}, Total in pool: ${deduplicated.length}`);

            if (added > 0 || modified) {
                const saveSuccess = await saveKeysToFirestoreDocument(deduplicated, idToken);
                if (!saveSuccess) {
                    return res.status(500).json({ success: false, error: "Failed to save keys to database." });
                }
                saveStoredKeys(deduplicated);
                invalidateCentralCache();
            }
            res.json({ success: true, added, total: deduplicated.length });
        } catch (e: any) {
            console.error("Error collecting keys:", e);
            res.status(500).json({ success: false, error: String(e?.message || e) });
        }
    });
});

// Admin endpoints to manage Central Keys
apiRouter.post("/admin/keys", async (req, res) => {
    withCentralKeysLock(async () => {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { label, key, contributorName, contributedBy, contributorEmail } = body;
            if (!label || !key) return res.status(400).send("Label and key required");
            
            const cleanKey = key.trim();
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;

            const fetchedKeys = await fetchKeysFromFirestore(idToken);
            if (fetchedKeys === null) {
                return res.status(503).json({ success: false, error: "Database temporarily unavailable, could not safely add key." });
            }
            const currentFirestoreKeys = fetchedKeys;
            
            // Plaintext value duplicate check
            const isDuplicate = currentFirestoreKeys.some(sk => {
                const dec = decrypt(sk.encryptedKey) || (sk as any).key || '';
                return dec.trim() === cleanKey;
            });

            if (isDuplicate) {
                return res.status(400).json({ error: "An API key with this exact value already exists in the central database." });
            }

            const encryptedKey = encrypt(cleanKey);
            const keyHash = crypto.createHash('sha256').update(cleanKey).digest('hex');
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

            currentFirestoreKeys.push(newKey);
            const deduplicated = deduplicateKeysByValue(currentFirestoreKeys);
            
            const saveSuccess = await saveKeysToFirestoreDocument(deduplicated, idToken);
            if (!saveSuccess) {
                return res.status(500).json({ success: false, error: "Failed to save key to database." });
            }
            
            saveStoredKeys(deduplicated);
            invalidateCentralCache();

            res.json({ id: newKey.id, label: newKey.label, enabled: true });
        } catch (e: any) {
            res.status(500).json({ success: false, error: String(e?.message || e) });
        }
    });
});

// Explicit deduplication endpoint for Admin
apiRouter.post("/admin/keys/deduplicate", async (req, res) => {
    withCentralKeysLock(async () => {
        try {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            invalidateCentralCache();
            const fetchedKeys = await fetchKeysFromFirestore(idToken);
            if (fetchedKeys === null) {
                return res.status(503).json({ success: false, error: "Database temporarily unavailable." });
            }
            const firestoreKeys = fetchedKeys;
            const originalCount = firestoreKeys.length;
            const deduplicated = deduplicateKeysByValue(firestoreKeys);
            const removedCount = originalCount - deduplicated.length;

            if (removedCount > 0) {
                const saveSuccess = await saveKeysToFirestoreDocument(deduplicated, idToken);
                if (!saveSuccess) {
                    return res.status(500).json({ success: false, error: "Failed to save deduplicated keys." });
                }
                saveStoredKeys(deduplicated);
                invalidateCentralCache();
                await syncCentralKeys(true, idToken);
            }

            res.json({
                success: true,
                originalCount,
                deduplicatedCount: deduplicated.length,
                removedCount
            });
        } catch (e: any) {
            res.status(500).json({ success: false, error: String(e?.message || e) });
        }
    });
});

apiRouter.post("/admin/keys/refresh", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
        invalidateCentralCache();
        await syncCentralKeys(true, idToken);
        const storedKeys = cachedFirestoreStoredKeys !== null ? [...cachedFirestoreStoredKeys] : (isProductionEnv() ? [] : loadStoredKeys());
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

            const isDead = Boolean(data.isDead || data.status === 'dead');
            const status = data.status || (isDead ? 'dead' : (data.enabled === false ? 'disabled' : 'active'));

            return {
                id: data.id,
                label: data.label,
                maskedKey,
                enabled: data.enabled !== false && !isDead,
                status,
                isDead,
                deadReason: data.deadReason || '',
                lastTestedAt: data.lastTestedAt || '',
                createdAt: data.createdAt,
                contributedBy: exactContributor,
                contributorName: exactContributor,
                contributorEmail: data.contributorEmail
            };
        });
        const activeKeys = keys.filter(k => k.enabled && !k.isDead && k.status !== 'dead').length;
        const deadKeys = keys.filter(k => k.isDead || k.status === 'dead').length;
        const disabledKeys = keys.filter(k => !k.enabled && !k.isDead && k.status !== 'dead').length;
        res.json({
            success: true,
            keys,
            totalKeys: keys.length,
            activeKeys,
            deadKeys,
            disabledKeys,
            updatedAt: new Date().toISOString(),
            version: 1
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e?.message || e) });
    }
});

apiRouter.get("/admin/keys", async (req, res) => {
    try {
        const force = req.query.refresh === 'true';
        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
        if (force) {
            invalidateCentralCache();
        }
        await syncCentralKeys(force, idToken);
        
        const storedKeys = cachedFirestoreStoredKeys !== null ? [...cachedFirestoreStoredKeys] : (isProductionEnv() ? [] : loadStoredKeys());
        
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

            const isDead = Boolean(data.isDead || data.status === 'dead');
            const status = data.status || (isDead ? 'dead' : (data.enabled === false ? 'disabled' : 'active'));

            return {
                id: data.id,
                label: data.label,
                maskedKey,
                enabled: data.enabled !== false && !isDead,
                status,
                isDead,
                deadReason: data.deadReason || '',
                lastTestedAt: data.lastTestedAt || '',
                createdAt: data.createdAt,
                contributedBy: exactContributor,
                contributorName: exactContributor,
                contributorEmail: data.contributorEmail
            };
        });
        const activeKeys = keys.filter(k => k.enabled && !k.isDead && k.status !== 'dead').length;
        const deadKeys = keys.filter(k => k.isDead || k.status === 'dead').length;
        const disabledKeys = keys.filter(k => !k.enabled && !k.isDead && k.status !== 'dead').length;
        res.json({
            keys,
            totalKeys: keys.length,
            activeKeys,
            deadKeys,
            disabledKeys,
            updatedAt: new Date().toISOString(),
            version: 1
        });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e?.message || e) });
    }
});

apiRouter.delete("/admin/keys", async (req, res) => {
    withCentralKeysLock(async () => {
        try {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            // Verify admin access via Firestore write
            const storedKeys: StoredKey[] = [];
            
            const success = await saveKeysToFirestoreDocument(storedKeys, idToken);
            if (!success && idToken) {
               return res.status(403).json({ success: false, error: "Unauthorized" });
            }
            saveStoredKeys(storedKeys);
            invalidateCentralCache();
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ success: false, error: String(e?.message || e) });
        }
    });
});

apiRouter.get("/admin/keys/export-csv", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
        let storedKeys = cachedFirestoreStoredKeys;
        if (storedKeys === null) {
            const firestoreKeys = await fetchKeysFromFirestore(idToken, false);
            if (firestoreKeys === null && isProductionEnv()) {
                return res.status(403).send("Unauthorized");
            }
            storedKeys = firestoreKeys || (isProductionEnv() ? [] : loadStoredKeys());
        }
        
        let csvContent = "api label,api key,contributor name,contributor gmail\n";
        for (const data of storedKeys) {
            let decryptedKey = '';
            try {
                decryptedKey = decrypt(data.encryptedKey) || '';
            } catch (e) {}
            if (!decryptedKey && (data as any).key) {
               decryptedKey = (data as any).key;
            }
            
            const label = `"${(data.label || '').replace(/"/g, '""')}"`;
            const key = `"${(decryptedKey || '').replace(/"/g, '""')}"`;
            
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
            const name = `"${exactContributor.replace(/"/g, '""')}"`;
            const email = `"${contributorEmail.replace(/"/g, '""')}"`;
            
            csvContent += `${label},${key},${name},${email}\n`;
        }
        
        res.header('Content-Type', 'text/csv');
        res.attachment('central_api_keys.csv');
        return res.send(csvContent);
    } catch (e: any) {
        res.status(500).send("Internal Server Error");
    }
});

apiRouter.get("/admin/keys/reveal", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
        let storedKeys = cachedFirestoreStoredKeys;
        if (storedKeys === null) {
            const firestoreKeys = await fetchKeysFromFirestore(idToken, false);
            if (firestoreKeys === null && isProductionEnv()) {
                return res.status(403).json({ success: false, error: "Unauthorized" });
            }
            storedKeys = firestoreKeys || (isProductionEnv() ? [] : loadStoredKeys());
        }
        
        const revealedKeys = storedKeys.map(data => {
            let decryptedKey = '';
            try {
                decryptedKey = decrypt(data.encryptedKey) || '';
            } catch (e) {}
            if (!decryptedKey && (data as any).key) {
               decryptedKey = (data as any).key;
            }
            return {
                id: data.id,
                decryptedKey
            };
        });
        
        res.json({ success: true, keys: revealedKeys });
    } catch (e: any) {
        res.status(500).json({ success: false, error: String(e?.message || e) });
    }
});

apiRouter.post("/admin/keys/test-single", async (req, res) => {
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { keyId, base64Image, rawKey, model } = body;
        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;

        let apiKey = '';
        if (rawKey && (rawKey.startsWith('AIza') || rawKey.startsWith('AQ.'))) {
            apiKey = rawKey.trim();
        } else if (keyId) {
            let storedKeys = cachedFirestoreStoredKeys;
            if (!storedKeys || storedKeys.length === 0) {
                storedKeys = loadStoredKeys();
            }
            let keyRecord = storedKeys?.find(k => k.id === keyId);
            if (!keyRecord) {
                const fetched = await fetchKeysFromFirestore(idToken, false);
                keyRecord = fetched?.find(k => k.id === keyId);
            }
            if (!keyRecord) {
                return res.status(404).json({ success: false, error: `Key '${keyId}' not found in registry.` });
            }
            try {
                apiKey = decrypt(keyRecord.encryptedKey) || (keyRecord as any).key || '';
            } catch (e) {
                apiKey = (keyRecord as any).key || keyRecord.encryptedKey || '';
            }
            if (!apiKey && keyRecord.encryptedKey && (keyRecord.encryptedKey.startsWith('AIza') || keyRecord.encryptedKey.startsWith('AQ.'))) {
                apiKey = keyRecord.encryptedKey;
            }
        }

        if (!apiKey || apiKey.length < 10) {
            return res.status(400).json({ success: false, error: "Invalid or missing API key." });
        }

        const ai = new GoogleGenAI({ apiKey });

        const promptParts: any[] = [];
        if (base64Image && typeof base64Image === 'string' && base64Image.includes(',')) {
            const base64Data = base64Image.split(',')[1];
            let mimeType = base64Image.substring(base64Image.indexOf(':') + 1, base64Image.indexOf(';')) || 'image/jpeg';
            if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(mimeType.toLowerCase())) {
                mimeType = 'image/jpeg';
            }
            promptParts.push({ inlineData: { mimeType, data: base64Data } });
        } else if (base64Image && typeof base64Image === 'string' && base64Image.length > 50) {
            promptParts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Image } });
        }

        if (promptParts.length > 0) {
            promptParts.push({
                text: "Analyze this image and generate a 1-sentence descriptive stock photo title."
            });
        } else {
            promptParts.push({
                text: "Reply with the word 'OK' to confirm you are online and functional."
            });
        }

        const targetModel = model || 'gemini-3.1-flash-lite-preview';

        const response = await ai.models.generateContent({
            model: targetModel,
            contents: promptParts,
        });

        const title = response?.text ? response.text.trim() : (response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '');

        if (!title) {
            return res.json({ success: false, error: "Model returned empty response." });
        }

        return res.json({ success: true, keyId, title });
    } catch (err: any) {
        const errorMsg = err?.message || String(err) || "Failed to generate title";
        return res.json({ success: false, keyId: req.body?.keyId, error: errorMsg });
    }
});

apiRouter.post("/admin/keys/mark-dead-batch", async (req, res) => {
    withCentralKeysLock(async () => {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { keyIds, reason } = body;
            if (!Array.isArray(keyIds) || keyIds.length === 0) {
                return res.json({ success: true, count: 0 });
            }
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            const fetchedKeys = await fetchKeysFromFirestore(idToken, true);
            if (fetchedKeys === null) {
                return res.status(503).json({ success: false, error: "Database temporarily unavailable." });
            }
            const idSet = new Set(keyIds);
            let markedCount = 0;
            const now = new Date().toISOString();

            for (const k of fetchedKeys) {
                if (idSet.has(k.id)) {
                    k.status = 'dead';
                    k.isDead = true;
                    k.enabled = false;
                    k.deadReason = reason || 'Failed Gemini API health check (3/3 attempts)';
                    k.lastTestedAt = now;
                    markedCount++;
                }
            }

            if (markedCount > 0) {
                const saveSuccess = await saveKeysToFirestoreDocument(fetchedKeys, idToken);
                if (!saveSuccess) {
                    return res.status(500).json({ success: false, error: "Failed to persist marked dead keys to database." });
                }
                saveStoredKeys(fetchedKeys);
                invalidateCentralCache();
                await syncCentralKeys(true, idToken);
            }

            console.log(`[Server] Labeled ${markedCount} API keys as DEAD (deactivated & stored).`);
            res.json({ success: true, count: markedCount });
        } catch (e: any) {
            console.error("Error marking dead keys batch:", e);
            res.status(500).json({ success: false, error: String(e?.message || e) });
        }
    });
});

apiRouter.post("/admin/keys/status-batch", async (req, res) => {
    withCentralKeysLock(async () => {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { keyIds, enabled, status } = body;
            if (!Array.isArray(keyIds) || keyIds.length === 0) {
                return res.json({ success: true, count: 0 });
            }
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            const fetchedKeys = await fetchKeysFromFirestore(idToken, true);
            if (fetchedKeys === null) {
                return res.status(503).json({ success: false, error: "Database temporarily unavailable." });
            }
            const idSet = new Set(keyIds);
            let updatedCount = 0;
            const targetEnabled = typeof enabled === 'boolean' ? enabled : true;

            for (const k of fetchedKeys) {
                if (idSet.has(k.id)) {
                    k.enabled = targetEnabled;
                    if (targetEnabled) {
                        k.isDead = false;
                        k.status = status || 'active';
                        k.deadReason = '';
                    } else {
                        k.status = status || (k.status === 'dead' ? 'dead' : 'disabled');
                    }
                    updatedCount++;
                }
            }

            if (updatedCount > 0) {
                const saveSuccess = await saveKeysToFirestoreDocument(fetchedKeys, idToken);
                if (!saveSuccess) {
                    return res.status(500).json({ success: false, error: "Failed to persist key statuses to database." });
                }
                saveStoredKeys(fetchedKeys);
                invalidateCentralCache();
                await syncCentralKeys(true, idToken);
            }

            console.log(`[Server] Updated ${updatedCount} API keys enabled state to ${targetEnabled}.`);
            res.json({ success: true, count: updatedCount });
        } catch (e: any) {
            console.error("Error updating keys status batch:", e);
            res.status(500).json({ success: false, error: String(e?.message || e) });
        }
    });
});

apiRouter.post("/admin/keys/delete-batch", async (req, res) => {
    withCentralKeysLock(async () => {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { keyIds } = body;
            if (!Array.isArray(keyIds) || keyIds.length === 0) {
                return res.json({ success: true, count: 0 });
            }
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            const fetchedKeys = await fetchKeysFromFirestore(idToken);
            if (fetchedKeys === null) {
                return res.status(503).json({ success: false, error: "Database temporarily unavailable." });
            }
            const idSet = new Set(keyIds);
            const remainingKeys = fetchedKeys.filter(k => !idSet.has(k.id));
            const saveSuccess = await saveKeysToFirestoreDocument(remainingKeys, idToken);
            if (!saveSuccess) {
                return res.status(500).json({ success: false, error: "Failed to save to database." });
            }
            saveStoredKeys(remainingKeys);
            invalidateCentralCache();
            res.json({ success: true, count: keyIds.length, remaining: remainingKeys.length });
        } catch (e: any) {
            res.status(500).json({ success: false, error: String(e?.message || e) });
        }
    });
});

apiRouter.delete("/admin/keys/:id", async (req, res) => {
    withCentralKeysLock(async () => {
        try {
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            const fetchedKeys = await fetchKeysFromFirestore(idToken);
            if (fetchedKeys === null) {
                return res.status(503).json({ success: false, error: "Database temporarily unavailable." });
            }
            let storedKeys = fetchedKeys;
            storedKeys = storedKeys.filter(k => k.id !== req.params.id);
            
            const saveSuccess = await saveKeysToFirestoreDocument(storedKeys, idToken);
            if (!saveSuccess) {
                return res.status(500).json({ success: false, error: "Failed to save to database." });
            }
            
            saveStoredKeys(storedKeys);
            invalidateCentralCache();

            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ success: false, error: String(e?.message || e) });
        }
    });
});

apiRouter.patch("/admin/keys/:id", async (req, res) => {
    withCentralKeysLock(async () => {
        try {
            const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
            const { enabled, status, isDead, deadReason, lastTestedAt } = body;
            const authHeader = req.headers.authorization;
            const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
            const fetchedKeys = await fetchKeysFromFirestore(idToken);
            if (fetchedKeys === null) {
                return res.status(503).json({ success: false, error: "Database temporarily unavailable." });
            }
            const storedKeys = fetchedKeys;
            const key = storedKeys.find(k => k.id === req.params.id);
            if (key) {
                if (typeof enabled === 'boolean') {
                    key.enabled = enabled;
                    if (enabled) {
                        // If re-enabling a key, clear dead status
                        key.isDead = false;
                        key.status = 'active';
                        key.deadReason = '';
                    } else if (key.status !== 'dead') {
                        key.status = 'disabled';
                    }
                }
                if (status) {
                    key.status = status;
                    if (status === 'dead') {
                        key.isDead = true;
                        key.enabled = false;
                    } else if (status === 'active') {
                        key.isDead = false;
                        key.enabled = true;
                    }
                }
                if (typeof isDead === 'boolean') {
                    key.isDead = isDead;
                    if (isDead) {
                        key.status = 'dead';
                        key.enabled = false;
                    }
                }
                if (typeof deadReason === 'string') {
                    key.deadReason = deadReason;
                }
                if (typeof lastTestedAt === 'string') {
                    key.lastTestedAt = lastTestedAt;
                }
                
                const saveSuccess = await saveKeysToFirestoreDocument(storedKeys, idToken);
                if (!saveSuccess) {
                    return res.status(500).json({ success: false, error: "Failed to save to database." });
                }
                
                saveStoredKeys(storedKeys);
                invalidateCentralCache();
                await syncCentralKeys(true, idToken);
            }
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });
});

apiRouter.post("/user/sync-device", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
        const { uid, deviceId, deviceMeta, isFirstAdmin } = req.body || {};
        
        if (!uid) {
            return res.status(400).json({ success: false, error: 'Missing uid' });
        }

        const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
        const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
        if (!projectId) {
            return res.json({ success: true, localOnly: true });
        }

        const dbCandidates = getFirestoreDbCandidates();
        for (const dbId of dbCandidates) {
            try {
                const getUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/users/${uid}${apiKey ? `?key=${apiKey}` : ''}`;
                const headers: Record<string, string> = {};
                if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
                
                const getResp = await fetch(getUrl, { headers });
                if (getResp.ok) {
                    const existingDoc = await getResp.json();
                    const fields = existingDoc.fields || {};
                    let existingIds = fields.deviceIds?.arrayValue?.values?.map((v: any) => v.stringValue).filter(Boolean) || [];
                    if (deviceId && !existingIds.includes(deviceId)) {
                        existingIds.push(deviceId);
                        if (existingIds.length > 2) existingIds = existingIds.slice(-2);
                    }

                    const updateMask = ['deviceIds', 'lastActiveAt'];
                    const nowIso = new Date().toISOString();
                    const patchFields: any = {
                        deviceIds: {
                            arrayValue: {
                                values: existingIds.map((id: string) => ({ stringValue: id }))
                            }
                        },
                        lastActiveAt: { stringValue: nowIso }
                    };

                    if (isFirstAdmin) {
                        patchFields.role = { stringValue: 'admin' };
                        patchFields.blocked = { booleanValue: false };
                        updateMask.push('role', 'blocked');
                    }

                    const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/users/${uid}?${updateMask.map(m => `updateMask.fieldPaths=${m}`).join('&')}${apiKey ? `&key=${apiKey}` : ''}`;
                    await fetch(patchUrl, {
                        method: 'PATCH',
                        headers: { ...headers, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fields: patchFields })
                    });
                    return res.json({ success: true });
                }
            } catch (err) {
                console.warn(`[Server] sync-device notice (${dbId}):`, err);
            }
        }
        return res.json({ success: true });
    } catch (e: any) {
        return res.status(500).json({ success: false, error: e?.message || 'Failed to sync device' });
    }
});

// Mount the API Router under /api
app.use('/api', apiRouter);

// Catch-all for undefined API endpoints
app.use('/api', (req, res) => {
    res.status(404).json({ error: `Central API endpoint ${req.method} ${req.originalUrl || req.path} not found` });
});

app.use((err: any, req: any, res: any, next: any) => {
    console.error("GLOBAL SERVER ERROR:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
});

async function startServer() {
    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        try {
            const { createServer: createViteServer } = await import('vite');
            const vite = await createViteServer({
                server: { middlewareMode: true },
                appType: "spa",
            });
            app.use(vite.middlewares);
        } catch (err) {
            console.error("Failed to load Vite middleware:", err);
        }
    } else if (!process.env.VERCEL) {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*all', (req, res) => {
            const indexPath = path.join(distPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else {
                res.status(404).send('Not Found');
            }
        });
    }

    if (!process.env.VERCEL) {
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on http://0.0.0.0:${PORT}`);
        });
    }
}

startServer();

