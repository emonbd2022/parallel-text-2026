import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { recordFirestoreRead, recordFirestoreWrite } from '../utils/firestoreAudit';

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
  status?: 'active' | 'dead' | 'untested' | 'disabled';
  isDead?: boolean;
  deadReason?: string;
  lastTestedAt?: string;
  createdAt: string;
}

// In-memory runtime cache for central keys to eliminate repeated Firestore reads
let cachedCentralKeys: CentralKeyRecord[] | null = null;
let lastCentralKeysFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL
let clientFetchPromise: Promise<CentralKeyRecord[]> | null = null;

const isDevSeedAllowed = () => {
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_CENTRAL_KEYS === 'true';
};

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
 * Server handles authoritative deduplication and persistence to Firestore single doc.
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

    const derivedContributor = (contributorName || (userEmail ? userEmail.split('@')[0] : 'User')).trim() || 'Contributor';
    let addedCount = 0;
    let totalCount = validKeys.length;

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
          keys: validKeys.map(k => ({
            label: k.label || 'User Contributed Key',
            key: k.key.trim(),
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
            addedCount = data.added ?? 0;
            totalCount = data.total ?? validKeys.length;
            if (addedCount > 0) {
              cachedCentralKeys = null;
            }
            return { success: true, total: totalCount, added: addedCount };
          }
        }
      }
    } catch (serverErr) {
      console.log('[Central Key Service] Server collect-keys notice, falling back to direct Firestore:', serverErr);
    }

    // 2. Direct Firestore fallback if server was not reachable (e.g. static site or network interruption)
    if (db) {
      try {
        const docRef = doc(db, 'central_keys', 'APIkeys');
        const docSnap = await getDoc(docRef);
        let existingKeys: any[] = [];
        if (docSnap.exists()) {
          existingKeys = docSnap.data().keys || [];
        }

        let localAdded = 0;
        for (const item of validKeys) {
          const trimmedKey = item.key.trim();
          const hash = await computeKeySha256(trimmedKey);
          const docId = `ck_${hash.substring(0, 24)}`;
          
          const exists = existingKeys.some((ex: any) => 
            ex.keyHash === hash || 
            ex.id === docId || 
            (ex.key && ex.key.trim() === trimmedKey)
          );

          if (!exists) {
            existingKeys.push({
              id: docId,
              label: item.label || 'User Contributed Key',
              key: trimmedKey,
              maskedKey: maskApiKey(trimmedKey),
              keyHash: hash,
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
          totalCount = existingKeys.length;
          cachedCentralKeys = null;
        } else {
          totalCount = existingKeys.length;
        }

        return { success: true, total: totalCount, added: addedCount };
      } catch (fsErr) {
        console.log('[Central Key Service] Direct Firestore collect sync notice:', fsErr);
      }
    }

    return { success: true, total: totalCount, added: addedCount };
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
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        console.warn('[Central Key Service] Backend routing error: /api/central-keys-pool returned HTML instead of JSON.');
        return cachedCentralKeys || [];
      }
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.keys)) {
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
    } catch (e) {
      console.log('[Central Key Service] Server pool endpoint notice:', e);
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
 * Fetches admin-level Central Key metadata list (masked credentials only).
 * Authoritative: If database contains 0 keys, strictly returns empty array [].
 */
export async function fetchAdminCentralKeys(forceRefresh = false): Promise<CentralKeyRecord[]> {
  // 1. First priority: Server-side admin endpoint (if running on Node.js/Cloud Run/Vercel)
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
  } catch (e) {
    console.log('[Central Key Service] Server admin keys fetch notice:', e);
  }

  // 2. Direct Firestore 1-read Fallback for Admin (e.g. static deployment)
  if (db) {
    try {
      const docRef = doc(db, 'central_keys', 'APIkeys');
      const docSnap = await getDoc(docRef);
      recordFirestoreRead('central_keys', 1, 'fetchAdminCentralKeys:direct');
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const rawKeys = Array.isArray(data.keys) ? data.keys : [];
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

      // Document does not exist in Firestore -> Authoritatively 0 keys
      return [];
    } catch (fsErr) {
      console.log('[Central Key Service] Direct Firestore fetch notice:', fsErr);
    }
  }

  return [];
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
      }
      const exists = existingKeys.some((k: any) => k.keyHash === hash || k.id === docId || (k.key && k.key.trim() === trimmedKey));
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
  newEnabledStatus: boolean,
  extra?: { status?: string; isDead?: boolean; deadReason?: string }
): Promise<void> {
  cachedCentralKeys = null; // Invalidate client cache

  const payload: any = { enabled: newEnabledStatus };
  if (extra) {
    if (extra.status) payload.status = extra.status;
    if (typeof extra.isDead === 'boolean') payload.isDead = extra.isDead;
    if (extra.deadReason) payload.deadReason = extra.deadReason;
  }

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
      body: JSON.stringify(payload)
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
          if (extra?.status) item.status = extra.status;
          if (typeof extra?.isDead === 'boolean') item.isDead = extra.isDead;
          if (extra?.deadReason) item.deadReason = extra.deadReason;
          if (newEnabledStatus) {
            item.isDead = false;
            item.status = 'active';
            item.deadReason = '';
          }
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
 * Toggles a batch of keys enabled/disabled status in Firestore and Server
 */
export async function toggleBatchCentralKeysStatus(
  keyIds: string[],
  enabled: boolean
): Promise<void> {
  if (!keyIds || keyIds.length === 0) return;
  cachedCentralKeys = null; // Invalidate client cache

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {}
    }

    await fetch('/api/admin/keys/status-batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ keyIds, enabled, status: enabled ? 'active' : 'disabled' })
    });
  } catch (e) {
    console.log('Server batch status warning:', e);
  }

  if (db) {
    try {
      const docRef = doc(db, 'central_keys', 'APIkeys');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const existingKeys: any[] = docSnap.data().keys || [];
        const idSet = new Set(keyIds);
        const now = new Date().toISOString();
        let changed = false;

        for (const k of existingKeys) {
          if (idSet.has(k.id)) {
            k.enabled = enabled;
            if (enabled) {
              k.isDead = false;
              k.status = 'active';
              k.deadReason = '';
            } else {
              k.status = k.isDead ? 'dead' : 'disabled';
            }
            k.lastTestedAt = now;
            changed = true;
          }
        }

        if (changed) {
          await setDoc(docRef, {
            keys: existingKeys,
            totalCount: existingKeys.length,
            updatedAt: now,
            version: 1
          }, { merge: true });
          recordFirestoreWrite('central_keys', 1, 'toggleBatchCentralKeysStatus:direct');
        }
      }
    } catch (fsErr) {
      console.log('Direct Firestore batch key status notice:', fsErr);
    }
  }
}

/**
 * Marks a single key as dead (deactivated & stored, not deleted)
 */
export async function markSingleCentralKeyDead(
  keyId: string,
  reason: string = 'Failed Gemini API health check (3/3 attempts)'
): Promise<void> {
  return toggleCentralKeyStatus(keyId, false, {
    status: 'dead',
    isDead: true,
    deadReason: reason
  });
}

/**
 * Marks a batch of keys as DEAD (stored but permanently deactivated from rotation, never deleted)
 */
export async function markBatchCentralKeysAsDead(
  keyIds: string[],
  reason: string = 'Failed Gemini API health check (3/3 attempts)'
): Promise<void> {
  if (!keyIds || keyIds.length === 0) return;
  cachedCentralKeys = null;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {}
    }

    await fetch('/api/admin/keys/mark-dead-batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ keyIds, reason })
    });
  } catch (e) {
    console.log('Server batch mark dead warning:', e);
  }

  if (db) {
    try {
      const docRef = doc(db, 'central_keys', 'APIkeys');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const existingKeys: any[] = docSnap.data().keys || [];
        const idSet = new Set(keyIds);
        const now = new Date().toISOString();
        let changed = false;

        for (const k of existingKeys) {
          if (idSet.has(k.id)) {
            k.enabled = false;
            k.status = 'dead';
            k.isDead = true;
            k.deadReason = reason;
            k.lastTestedAt = now;
            changed = true;
          }
        }

        if (changed) {
          await setDoc(docRef, {
            keys: existingKeys,
            totalCount: existingKeys.length,
            updatedAt: now,
            version: 1
          }, { merge: true });
          recordFirestoreWrite('central_keys', 1, 'markBatchCentralKeysAsDead:direct');
        }
      }
    } catch (fsErr) {
      console.log('Direct Firestore batch key mark dead notice:', fsErr);
    }
  }
}

/**
 * Deletes ALL keys from Firestore single document and Server authoritative registry
 */
export async function deleteAllCentralKeys(): Promise<{ success: boolean; error?: string }> {
  cachedCentralKeys = null; // Invalidate client cache

  let serverSuccess = false;
  try {
    const headers: Record<string, string> = {};
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken(true)}`;
      } catch {}
    }

    const res = await fetch('/api/admin/keys', {
      method: 'DELETE',
      headers
    });
    if (res.ok) {
      serverSuccess = true;
    }
  } catch (e) {
    console.log('[Central Key Service] Server clear-all warning:', e);
  }

  // Also directly update Firestore document central_keys/APIkeys using client SDK to guarantee atomic wipe
  if (db) {
    try {
      const docRef = doc(db, 'central_keys', 'APIkeys');
      await setDoc(docRef, {
        keys: [],
        totalCount: 0,
        updatedAt: new Date().toISOString(),
        version: 1
      });
      recordFirestoreWrite('central_keys', 1, 'deleteAllCentralKeys:direct');
      return { success: true };
    } catch (fsErr: any) {
      console.error('[Central Key Service] Direct Firestore clear-all error:', fsErr);
      if (!serverSuccess) {
        return { success: false, error: fsErr?.message || 'Failed to clear central keys in Firestore' };
      }
    }
  }

  return { success: serverSuccess };
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

/**
 * Triggers server-side and Firestore deduplication comparing real decrypted key values
 */
export async function deduplicateCentralKeysOnServer(): Promise<{ success: boolean; originalCount: number; deduplicatedCount: number; removedCount: number }> {
  cachedCentralKeys = null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth?.currentUser) {
    try {
      headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
    } catch {}
  }

  const res = await fetch('/api/admin/keys/deduplicate', {
    method: 'POST',
    headers
  });

  if (res.ok) {
    return await res.json();
  }
  throw new Error(`Deduplication request failed with status ${res.status}`);
}

/**
 * Tests a single central key by attempting to generate a stock photo title using a demo image.
 */
export async function testSingleCentralKey(
  keyId: string,
  base64Image: string,
  model: string = 'gemini-3.1-flash-lite-preview'
): Promise<{ success: boolean; title?: string; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {}
    }

    const res = await fetch('/api/admin/keys/test-single', {
      method: 'POST',
      headers,
      body: JSON.stringify({ keyId, base64Image, model })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return { success: true, title: data.title };
    }
    return { success: false, error: data.error || `HTTP ${res.status}: Failed to generate title` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while testing key' };
  }
}

/**
 * Deletes a batch of dead keys from Firestore and server storage.
 */
export async function deleteBatchCentralKeys(keyIds: string[]): Promise<void> {
  if (!keyIds || keyIds.length === 0) return;
  cachedCentralKeys = null;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {}
    }

    await fetch('/api/admin/keys/delete-batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ keyIds })
    });
  } catch (e) {
    console.log('Server batch delete warning:', e);
  }

  if (db) {
    try {
      const docRef = doc(db, 'central_keys', 'APIkeys');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const existingKeys: any[] = docSnap.data().keys || [];
        const idSet = new Set(keyIds);
        const filtered = existingKeys.filter((k: any) => !idSet.has(k.id));
        await setDoc(docRef, {
          keys: filtered,
          totalCount: filtered.length,
          updatedAt: new Date().toISOString(),
          version: 1
        }, { merge: true });
        recordFirestoreWrite('central_keys', 1, 'deleteBatchCentralKeys:direct');
      }
    } catch (fsErr) {
      console.log('Direct Firestore batch key delete notice:', fsErr);
    }
  }
}

export interface ParsedCsvKey {
  label: string;
  key: string;
  contributorName: string;
  contributorEmail: string;
}

/**
 * Parses CSV text into an array of Central Key items according to standard format:
 * "api label,api key,contributor name,contributor gmail"
 */
export function parseCentralKeysCSV(csvText: string): ParsedCsvKey[] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some(field => field.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) return [];

  // Detect header indices
  let startIndex = 0;
  let labelIdx = 0;
  let keyIdx = 1;
  let nameIdx = 2;
  let emailIdx = 3;

  const firstRow = lines[0].map(c => c.toLowerCase().trim());
  const hasHeader = firstRow.some(c => 
    c.includes('api') || 
    c.includes('label') || 
    c.includes('key') || 
    c.includes('contributor') || 
    c.includes('gmail') || 
    c.includes('email')
  );

  if (hasHeader) {
    startIndex = 1;
    const lIdx = firstRow.findIndex(c => c.includes('label') || c === 'api label');
    const kIdx = firstRow.findIndex(c => c.includes('key') || c === 'api key');
    const nIdx = firstRow.findIndex(c => c.includes('name') || c === 'contributor name');
    const eIdx = firstRow.findIndex(c => c.includes('gmail') || c.includes('email') || c === 'contributor gmail' || c === 'contributor email');
    
    if (lIdx !== -1) labelIdx = lIdx;
    if (kIdx !== -1) keyIdx = kIdx;
    if (nIdx !== -1) nameIdx = nIdx;
    if (eIdx !== -1) emailIdx = eIdx;
  }

  const results: ParsedCsvKey[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const row = lines[i];
    const key = (row[keyIdx] || '').trim();
    if (!key || key.length < 8) continue; // Skip invalid or empty keys

    const label = (row[labelIdx] || '').trim() || 'Central Key';
    const contributorName = (row[nameIdx] || '').trim() || 'Admin';
    const contributorEmail = (row[emailIdx] || '').trim() || '';

    results.push({
      label,
      key,
      contributorName,
      contributorEmail
    });
  }

  return results;
}

/**
 * Imports an array of keys into the server central pool and Firestore database
 */
export async function importCentralKeys(
  keys: ParsedCsvKey[]
): Promise<{ success: boolean; addedCount: number; skippedCount: number; totalKeys: number; error?: string }> {
  if (!keys || keys.length === 0) {
    return { success: false, addedCount: 0, skippedCount: 0, totalKeys: 0, error: "No keys to import." };
  }

  cachedCentralKeys = null; // Invalidate client cache

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth?.currentUser) {
      try {
        headers['Authorization'] = `Bearer ${await auth.currentUser.getIdToken()}`;
      } catch {}
    }

    const res = await fetch('/api/admin/keys/import-csv', {
      method: 'POST',
      headers,
      body: JSON.stringify({ keys })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return {
          success: true,
          addedCount: data.addedCount || 0,
          skippedCount: data.skippedCount || 0,
          totalKeys: data.totalKeys || 0
        };
      }
    }
  } catch (err: any) {
    console.log('[Central Key Service] Server import-csv notice:', err);
  }

  // Fallback to direct Firestore single doc update
  if (db) {
    try {
      const docRef = doc(db, 'central_keys', 'APIkeys');
      const docSnap = await getDoc(docRef);
      let existingKeys: any[] = [];
      if (docSnap.exists()) {
        existingKeys = docSnap.data().keys || [];
      }

      let addedCount = 0;
      let skippedCount = 0;

      for (const item of keys) {
        const trimmedKey = item.key.trim();
        const hash = await computeKeySha256(trimmedKey);
        const docId = `ck_${hash.substring(0, 24)}`;
        
        const exists = existingKeys.some((ex: any) => 
          ex.keyHash === hash || 
          ex.id === docId || 
          (ex.key && ex.key.trim() === trimmedKey)
        );

        if (!exists) {
          existingKeys.push({
            id: docId,
            label: item.label || 'Central Key',
            key: trimmedKey,
            maskedKey: maskApiKey(trimmedKey),
            keyHash: hash,
            enabled: true,
            createdAt: new Date().toISOString(),
            contributedBy: item.contributorName || 'Admin',
            contributorName: item.contributorName || 'Admin',
            contributorEmail: item.contributorEmail || ''
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      if (addedCount > 0) {
        await setDoc(docRef, {
          keys: existingKeys,
          totalCount: existingKeys.length,
          updatedAt: new Date().toISOString(),
          version: 1
        }, { merge: true });
        recordFirestoreWrite('central_keys', 1, 'importCentralKeys:direct');
      }

      return {
        success: true,
        addedCount,
        skippedCount,
        totalKeys: existingKeys.length
      };
    } catch (fsErr: any) {
      console.error('[Central Key Service] Direct Firestore import error:', fsErr);
      return {
        success: false,
        addedCount: 0,
        skippedCount: 0,
        totalKeys: 0,
        error: fsErr?.message || "Failed to save imported keys to Firestore."
      };
    }
  }

  return { success: false, addedCount: 0, skippedCount: 0, totalKeys: 0, error: "Database not available." };
}


