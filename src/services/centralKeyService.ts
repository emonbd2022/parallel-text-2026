import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { recordFirestoreRead, recordFirestoreWrite } from '../utils/firestoreAudit';
import { INITIAL_CENTRAL_KEYS, InitialCentralKeyRecord } from '../data/initialCentralKeys';

export interface CentralKeyRecord {
  id: string;
  label: string;
  key: string;
  maskedKey: string;
  keyHash: string;
  contributedBy: string;
  contributorName?: string;
  contributorEmail?: string;
  enabled: boolean;
  createdAt: string;
}

// In-memory runtime cache for central keys to eliminate repeated Firestore reads
let cachedCentralKeys: CentralKeyRecord[] | null = null;
let lastCentralKeysFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL
let clientFetchPromise: Promise<CentralKeyRecord[]> | null = null;

/**
 * Computes a browser-compatible SHA-256 hash string for deterministic key fingerprinting
 */
export async function computeKeySha256(text: string): Promise<string> {
  const trimmed = text.trim();
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(trimmed);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.log('SubtleCrypto error, falling back to simple hash', e);
  }
  // Fallback deterministic hash if subtle crypto not available
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h_' + Math.abs(hash).toString(16);
}

/**
 * Masks an API key for safe display (e.g. AIzaSy••••••••Ab12)
 */
export function maskApiKey(rawKey: string): string {
  const clean = rawKey.trim();
  if (clean.length < 10) return '••••••••';
  return `${clean.substring(0, 6)}••••••••${clean.substring(clean.length - 4)}`;
}

/**
 * Helper to derive correct contributor name avoiding 'central', 'anonymous', or label collisions
 */
export function deriveContributorDisplay(k: any): { name: string; email: string } {
  const email = (k.contributorEmail || '').trim();
  let derivedName = '';

  if (k.contributorName && k.contributorName !== k.label && k.contributorName !== 'central' && k.contributorName !== 'anonymous') {
    derivedName = k.contributorName;
  } else if (k.contributedBy && k.contributedBy !== k.label && k.contributedBy !== 'central' && k.contributedBy !== 'anonymous') {
    derivedName = k.contributedBy;
  } else if (email) {
    derivedName = email.split('@')[0];
  } else {
    derivedName = 'Community Contributor';
  }

  return { name: derivedName, email };
}

/**
 * Retrieves the local synchronization registry key name for a user
 */
function getSyncRegistryKey(userUid?: string): string {
  return `syncedCentralKeyFingerprints_${userUid || 'anonymous'}`;
}

/**
 * Synchronizes user local API keys into the Central API pool
 * strictly event-driven: ONLY writes genuinely new/differing keys (0 writes if already synced).
 */
export async function syncUserKeysToFirestore(
  keys: { label: string; key: string }[],
  userUid?: string,
  userEmail?: string,
  contributorName?: string
): Promise<{ success: boolean; total: number; added: number; error?: string }> {
  try {
    const validKeys = keys.filter(
      k => k.key && !k.key.startsWith('central-') && k.key.trim().length > 15
    );

    if (validKeys.length === 0) {
      return { success: true, total: 0, added: 0 };
    }

    const registryKey = getSyncRegistryKey(userUid);
    let syncedFingerprints: string[] = [];
    try {
      const stored = localStorage.getItem(registryKey) || sessionStorage.getItem(registryKey);
      if (stored) syncedFingerprints = JSON.parse(stored);
    } catch {}

    const syncedSet = new Set(syncedFingerprints);
    const keysToSync: { item: { label: string; key: string }; hash: string; docId: string }[] = [];

    for (const item of validKeys) {
      const trimmedKey = item.key.trim();
      const hash = await computeKeySha256(trimmedKey);
      if (!syncedSet.has(hash)) {
        const docId = `ck_${hash.substring(0, 24)}`;
        keysToSync.push({ item, hash, docId });
      }
    }

    // If all keys are already present in the local sync registry, do 0 network calls / 0 writes
    if (keysToSync.length === 0) {
      return { success: true, total: validKeys.length, added: 0 };
    }

    let addedCount = 0;
    const derivedContributor = contributorName || (userEmail ? userEmail.split('@')[0] : 'User');

    // 1. Sync to server-side registry (which handles server memory, AES-256-GCM encryption & single Firestore doc)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth?.currentUser) {
        try {
          headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
        } catch {}
      }

      const res = await fetch('/api/collect-keys', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          keys: keysToSync.map(k => ({
            label: k.item.label || 'User Contributed Key',
            key: k.item.key,
            contributorName: derivedContributor,
            contributedBy: derivedContributor,
            contributorEmail: userEmail || ''
          }))
        })
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success) {
            addedCount = data.added ?? keysToSync.length;
          }
        }
      }
    } catch (serverErr) {
      console.log('[Central Key Service] Server collect-keys notice:', serverErr);
    }

    // 2. Direct Firestore fallback if server was not reachable (e.g. static site)
    if (addedCount === 0 && db && auth?.currentUser) {
      try {
        const docRef = doc(db, 'central_keys', 'APIkeys');
        const docSnap = await getDoc(docRef);
        let existingKeys: any[] = [];
        if (docSnap.exists()) {
          existingKeys = docSnap.data().keys || [];
        }
        let localAdded = 0;
        for (const k of keysToSync) {
          const exists = existingKeys.some((ex: any) => ex.keyHash === k.hash || ex.id === k.docId);
          if (!exists) {
            existingKeys.push({
              id: k.docId,
              label: k.item.label || 'User Contributed Key',
              key: k.item.key,
              maskedKey: maskApiKey(k.item.key),
              keyHash: k.hash,
              enabled: true,
              createdAt: new Date().toISOString(),
              contributedBy: derivedContributor,
              contributorName: derivedContributor,
              contributorEmail: userEmail || ''
            });
            localAdded++;
          }
        }
        if (localAdded > 0) {
          await setDoc(docRef, {
            keys: existingKeys,
            totalCount: existingKeys.length,
            updatedAt: new Date().toISOString(),
            version: 1
          }, { merge: true });
          recordFirestoreWrite('central_keys', 1, 'syncUserKeysToFirestore:direct');
          addedCount = localAdded;
        }
      } catch (fsErr) {
        console.log('[Central Key Service] Direct Firestore collect sync notice:', fsErr);
      }
    }

    // Update local persistent cache of synced hashes
    try {
      keysToSync.forEach(k => syncedSet.add(k.hash));
      const arr = Array.from(syncedSet);
      localStorage.setItem(registryKey, JSON.stringify(arr));
      sessionStorage.setItem(registryKey, JSON.stringify(arr));
    } catch {}

    // Invalidate client cache if keys were added
    if (addedCount > 0) {
      cachedCentralKeys = null;
    }

    return { success: true, total: validKeys.length, added: addedCount };
  } catch (error: any) {
    console.log('[Central Key Service] Sync error:', error);
    return { success: false, total: 0, added: 0, error: error?.message || 'Failed to sync keys' };
  }
}

/**
 * Fetches central API keys from the server registry cache.
 * Normal users receive anonymous virtual node handles (0 raw secrets).
 * Performs 0 Firestore collection reads from client browsers.
 * @param forceRefresh If true, requests a fresh sync from server
 */
export async function fetchCentralKeysFromFirestore(forceRefresh = false): Promise<CentralKeyRecord[]> {
  const now = Date.now();
  if (!forceRefresh && cachedCentralKeys && (now - lastCentralKeysFetchTime < CACHE_TTL_MS)) {
    return cachedCentralKeys;
  }

  // Concurrent request lock on client
  if (clientFetchPromise) {
    return await clientFetchPromise;
  }

  clientFetchPromise = (async () => {
    try {
      // 1. First priority: Server-side Central Key Registry endpoint
      const res = await fetch(`/api/central-keys-pool${forceRefresh ? '?refresh=true' : ''}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success && Array.isArray(data.keys) && data.keys.length > 0) {
            const mapped = data.keys.map((sk: any, idx: number) => ({
              id: sk.id || `central-${idx}`,
              label: sk.label || `Central Pool Node ${idx + 1}`,
              key: sk.id || `central-${idx}`, // Virtual node ID
              maskedKey: '••••••••',
              keyHash: sk.id || `central-${idx}`,
              contributedBy: 'central-pool',
              enabled: true,
              createdAt: new Date().toISOString()
            }));
            cachedCentralKeys = mapped;
            lastCentralKeysFetchTime = Date.now();
            return mapped;
          }
        }
      }
    } catch (e) {
      console.log('[Central Key Service] Server pool endpoint notice:', e);
    }

    // Direct Firestore fallback for client (e.g. Vercel deployment)
    if (db) {
      try {
        const docSnap = await getDoc(doc(db, 'central_keys', 'APIkeys'));
        recordFirestoreRead('central_keys', 1, 'fetchCentralKeys:directPool');
        if (docSnap.exists()) {
          const data = docSnap.data();
          const rawKeys = Array.isArray(data.keys) ? data.keys : [];
          const activeKeys = rawKeys.filter((k: any) => k.enabled !== false);
          if (activeKeys.length > 0) {
            const mapped = activeKeys.map((k: any, idx: number) => ({
              id: k.id || `central-${idx}`,
              label: `Central Pool Node ${idx + 1}`,
              key: k.id || `central-${idx}`, // Virtual node handle (never raw key)
              maskedKey: '••••••••',
              keyHash: k.keyHash || k.id,
              contributedBy: 'central-pool',
              enabled: true,
              createdAt: k.createdAt || new Date().toISOString()
            }));
            cachedCentralKeys = mapped;
            lastCentralKeysFetchTime = Date.now();
            return mapped;
          }
        }
      } catch (fsErr) {
        console.log('[Central Key Service] Direct Firestore pool notice:', fsErr);
      }
    }

    return cachedCentralKeys || [];
  })();

  try {
    return await clientFetchPromise;
  } finally {
    clientFetchPromise = null;
  }
}

/**
 * Fetches admin-level Central Key metadata list (masked credentials only)
 */
export async function fetchAdminCentralKeys(forceRefresh = false): Promise<CentralKeyRecord[]> {
  // 1. First priority: Server-side admin endpoint (if running on Node.js/Cloud Run)
  try {
    const url = forceRefresh ? '/api/admin/keys?refresh=true' : '/api/admin/keys';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {}
    }

    const res = await fetch(url, { method: 'GET', headers });
    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.keys || []);
        if (list.length > 0) {
          return list.map((k: any) => {
            const { name: derivedContributor, email } = deriveContributorDisplay(k);
            return {
              id: k.id,
              label: k.label || 'Central Key',
              key: '', // Never expose raw key
              maskedKey: k.maskedKey || '••••••••',
              keyHash: k.keyHash || k.id,
              contributedBy: derivedContributor,
              contributorName: derivedContributor,
              contributorEmail: email,
              enabled: k.enabled !== false,
              createdAt: k.createdAt || new Date().toISOString()
            };
          });
        }
      }
    }
  } catch (e) {
    console.log('[Central Key Service] Server admin keys fetch notice:', e);
  }

  // 2. Direct Firestore 1-read Fallback for Admin (e.g. Vercel static deployment)
  if (db) {
    try {
      const docRef = doc(db, 'central_keys', 'APIkeys');
      const docSnap = await getDoc(docRef);
      recordFirestoreRead('central_keys', 1, 'fetchAdminCentralKeys:direct');
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const rawKeys = Array.isArray(data.keys) ? data.keys : [];
        if (rawKeys.length > 0) {
          return rawKeys.map((k: any) => {
            const { name: derivedContributor, email } = deriveContributorDisplay(k);
            return {
              id: k.id,
              label: k.label || 'Central Key',
              key: '',
              maskedKey: k.maskedKey || (k.key ? maskApiKey(k.key) : '••••••••'),
              keyHash: k.keyHash || k.id,
              contributedBy: derivedContributor,
              contributorName: derivedContributor,
              contributorEmail: email,
              enabled: k.enabled !== false,
              createdAt: k.createdAt || new Date().toISOString()
            };
          });
        }
      }

      // Auto-seed Initial Central Keys into Firestore if empty or document doesn't exist
      try {
        await setDoc(docRef, {
          keys: INITIAL_CENTRAL_KEYS,
          totalCount: INITIAL_CENTRAL_KEYS.length,
          updatedAt: new Date().toISOString(),
          version: 1
        }, { merge: true });
        recordFirestoreWrite('central_keys', 1, 'seedInitialCentralKeys:direct');
      } catch (seedErr) {
        console.log('[Central Key Service] Auto-seed Firestore central keys notice:', seedErr);
      }

      // Return mapped initial keys immediately so Admin UI is instantly populated
      return INITIAL_CENTRAL_KEYS.map(k => {
        const { name: derivedContributor, email } = deriveContributorDisplay(k);
        return {
          id: k.id,
          label: k.label,
          key: '',
          maskedKey: k.maskedKey || '••••••••',
          keyHash: k.keyHash,
          contributedBy: derivedContributor,
          contributorName: derivedContributor,
          contributorEmail: email,
          enabled: k.enabled !== false,
          createdAt: k.createdAt
        };
      });
    } catch (fsErr) {
      console.log('[Central Key Service] Direct Firestore fetch notice:', fsErr);
    }
  }

  // Fallback to static initial list if offline or Firestore uninitialized
  return INITIAL_CENTRAL_KEYS.map(k => {
    const { name: derivedContributor, email } = deriveContributorDisplay(k);
    return {
      id: k.id,
      label: k.label,
      key: '',
      maskedKey: k.maskedKey || '••••••••',
      keyHash: k.keyHash,
      contributedBy: derivedContributor,
      contributorName: derivedContributor,
      contributorEmail: email,
      enabled: k.enabled !== false,
      createdAt: k.createdAt
    };
  });
}

/**
 * Adds a new Central Key directly via Server (which encrypts and updates central_keys/APIkeys)
 * and direct Firestore single-document fallback
 */
export async function addCentralKeyToFirestore(
  label: string,
  key: string,
  userUid?: string,
  userEmail?: string,
  contributorName?: string
): Promise<CentralKeyRecord> {
  const trimmedKey = key.trim();
  const hash = await computeKeySha256(trimmedKey);
  const docId = `ck_${hash.substring(0, 24)}`;
  const masked = maskApiKey(trimmedKey);
  const exactName = contributorName || (userEmail ? userEmail.split('@')[0] : 'Admin');

  const record: CentralKeyRecord = {
    id: docId,
    label: label.trim() || 'Central Key',
    key: trimmedKey,
    maskedKey: masked,
    keyHash: hash,
    contributedBy: exactName,
    contributorName: exactName,
    contributorEmail: userEmail || 'admin',
    enabled: true,
    createdAt: new Date().toISOString()
  };

  cachedCentralKeys = null; // Invalidate client cache

  // 1. Sync to server API
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {}
    }

    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        label: record.label,
        key: trimmedKey,
        contributorName: exactName,
        contributedBy: exactName,
        contributorEmail: userEmail || ''
      })
    });
    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.id) record.id = data.id;
      }
    }
  } catch (err) {
    console.log('Server key sync notice:', err);
  }

  // 2. Direct Firestore single-document fallback
  if (db) {
    try {
      const docRef = doc(db, 'central_keys', 'APIkeys');
      const docSnap = await getDoc(docRef);
      let existingKeys: any[] = [];
      if (docSnap.exists()) {
        existingKeys = docSnap.data().keys || [];
      } else {
        existingKeys = [...INITIAL_CENTRAL_KEYS];
      }
      const exists = existingKeys.some((k: any) => k.keyHash === hash || k.id === docId);
      if (!exists) {
        existingKeys.push({
          id: docId,
          label: record.label,
          key: trimmedKey,
          maskedKey: masked,
          keyHash: hash,
          enabled: true,
          createdAt: record.createdAt,
          contributedBy: exactName,
          contributorName: exactName,
          contributorEmail: userEmail || ''
        });
        await setDoc(docRef, {
          keys: existingKeys,
          totalCount: existingKeys.length,
          updatedAt: new Date().toISOString(),
          version: 1
        }, { merge: true });
        recordFirestoreWrite('central_keys', 1, 'addCentralKeyToFirestore:direct');
      }
    } catch (fsErr) {
      console.log('Direct Firestore key write notice:', fsErr);
    }
  }

  return record;
}

/**
 * Toggles a key enabled/disabled status in Firestore and Server
 */
export async function toggleCentralKeyStatus(
  keyId: string,
  newEnabledStatus: boolean
): Promise<void> {
  cachedCentralKeys = null; // Invalidate client cache

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {}
    }

    await fetch(`/api/admin/keys/${keyId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ enabled: newEnabledStatus })
    });
  } catch (e) {
    console.log('Server patch warning:', e);
  }

  if (db) {
    try {
      const docRef = doc(db, 'central_keys', 'APIkeys');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const existingKeys: any[] = docSnap.data().keys || [];
        const item = existingKeys.find((k: any) => k.id === keyId);
        if (item) {
          item.enabled = newEnabledStatus;
          await setDoc(docRef, {
            keys: existingKeys,
            totalCount: existingKeys.length,
            updatedAt: new Date().toISOString(),
            version: 1
          }, { merge: true });
          recordFirestoreWrite('central_keys', 1, 'toggleCentralKeyStatus:direct');
        }
      }
    } catch (fsErr) {
      console.log('Direct Firestore key update notice:', fsErr);
    }
  }
}

/**
 * Deletes a key from Firestore and Server
 */
export async function deleteCentralKeyFromFirestore(keyId: string): Promise<void> {
  cachedCentralKeys = null; // Invalidate client cache

  try {
    const headers: Record<string, string> = {};
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {}
    }

    await fetch(`/api/admin/keys/${keyId}`, {
      method: 'DELETE',
      headers
    });
  } catch (e) {
    console.log('Server delete warning:', e);
  }

  if (db) {
    try {
      const docRef = doc(db, 'central_keys', 'APIkeys');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const existingKeys: any[] = docSnap.data().keys || [];
        const filtered = existingKeys.filter((k: any) => k.id !== keyId);
        await setDoc(docRef, {
          keys: filtered,
          totalCount: filtered.length,
          updatedAt: new Date().toISOString(),
          version: 1
        }, { merge: true });
        recordFirestoreWrite('central_keys', 1, 'deleteCentralKeyFromFirestore:direct');
      }
    } catch (fsErr) {
      console.log('Direct Firestore key delete notice:', fsErr);
    }
  }
}
