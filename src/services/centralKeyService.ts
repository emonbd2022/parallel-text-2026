import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { recordFirestoreRead, recordFirestoreWrite } from '../utils/firestoreAudit';

export interface CentralKeyRecord {
  id: string;
  label: string;
  key: string;
  maskedKey: string;
  keyHash: string;
  contributedBy: string;
  contributorEmail?: string;
  enabled: boolean;
  createdAt: string;
}

// In-memory runtime cache for central keys to eliminate repeated Firestore reads
let cachedCentralKeys: CentralKeyRecord[] | null = null;
let lastCentralKeysFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL

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
    console.warn('SubtleCrypto error, falling back to simple hash', e);
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
 * Retrieves the local synchronization registry key name for a user
 */
function getSyncRegistryKey(userUid?: string): string {
  return `syncedCentralKeyFingerprints_${userUid || 'anonymous'}`;
}

/**
 * Synchronizes user local API keys into the Firestore `central_keys` collection
 * strictly event-driven: ONLY writes genuinely new/differing keys (0 writes if already synced).
 */
export async function syncUserKeysToFirestore(
  keys: { label: string; key: string }[],
  userUid?: string,
  userEmail?: string
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
      const stored = localStorage.getItem(registryKey) || localStorage.getItem('synced_key_hashes_v1');
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

    // If all keys are already present in the local sync registry, do 0 Firestore writes
    if (keysToSync.length === 0) {
      return { success: true, total: validKeys.length, added: 0 };
    }

    let addedCount = 0;

    if (db) {
      for (const { item, hash, docId } of keysToSync) {
        const trimmedKey = item.key.trim();
        const masked = maskApiKey(trimmedKey);
        const record: CentralKeyRecord = {
          id: docId,
          label: item.label.trim() || 'Contributed Key',
          key: trimmedKey,
          maskedKey: masked,
          keyHash: hash,
          contributedBy: userUid || 'anonymous',
          contributorEmail: userEmail || 'user',
          enabled: true,
          createdAt: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, 'central_keys', docId), record, { merge: true });
          recordFirestoreWrite('central_keys', 1, 'syncUserKeysToFirestore');
          syncedSet.add(hash);
          addedCount++;
        } catch (fsErr) {
          console.warn('[Central Key Service] Firestore write notice:', fsErr);
        }
      }

      try {
        localStorage.setItem(registryKey, JSON.stringify(Array.from(syncedSet)));
        localStorage.setItem('synced_key_hashes_v1', JSON.stringify(Array.from(syncedSet)));
      } catch {}

      // Invalidate memory cache so next read fetches fresh pool if new keys were added
      if (addedCount > 0) {
        cachedCentralKeys = null;
      }
    }

    return { success: true, total: validKeys.length, added: addedCount };
  } catch (error: any) {
    console.error('[Central Key Service] Sync error:', error);
    return { success: false, total: 0, added: 0, error: error?.message || 'Failed to sync keys' };
  }
}

/**
 * Fetches all central API keys from Firestore (cached in-memory with TTL)
 * @param forceRefresh If true, bypasses the in-memory cache and fetches freshly
 */
export async function fetchCentralKeysFromFirestore(forceRefresh = false): Promise<CentralKeyRecord[]> {
  const now = Date.now();
  if (!forceRefresh && cachedCentralKeys && (now - lastCentralKeysFetchTime < CACHE_TTL_MS)) {
    return cachedCentralKeys;
  }

  try {
    if (db) {
      const snap = await getDocs(collection(db, 'central_keys'));
      recordFirestoreRead('central_keys', snap.docs.length || 1, 'fetchCentralKeysFromFirestore');

      if (!snap.empty) {
        const records = snap.docs.map(d => ({
          ...d.data(),
          id: d.id
        } as CentralKeyRecord));

        // Sort in memory by createdAt descending
        records.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        cachedCentralKeys = records;
        lastCentralKeysFetchTime = now;
        return records;
      }
    }
  } catch (e) {
    console.warn('[Central Key Service] Firestore fetch notice:', e);
  }

  // Server endpoint fallback (when running with Node backend)
  try {
    const res = await fetch('/api/central-keys-pool');
    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success && Array.isArray(data.keys)) {
          const mapped = data.keys.map((sk: any, idx: number) => ({
            id: sk.id || `central-${idx}`,
            label: `Central Pool Node ${idx + 1}`,
            key: sk.key || '',
            maskedKey: sk.key ? maskApiKey(sk.key) : '••••••••',
            keyHash: sk.id,
            contributedBy: 'server',
            enabled: true,
            createdAt: new Date().toISOString()
          }));
          cachedCentralKeys = mapped;
          lastCentralKeysFetchTime = now;
          return mapped;
        }
      }
    }
  } catch (e) {
    // Ignore server error on static hosts
  }

  return [];
}

/**
 * Adds a new Central Key directly to Firestore and Server
 */
export async function addCentralKeyToFirestore(
  label: string,
  key: string,
  userUid?: string,
  userEmail?: string
): Promise<CentralKeyRecord> {
  const trimmedKey = key.trim();
  const hash = await computeKeySha256(trimmedKey);
  const docId = `ck_${hash.substring(0, 24)}`;
  const masked = maskApiKey(trimmedKey);

  const record: CentralKeyRecord = {
    id: docId,
    label: label.trim() || 'Central Key',
    key: trimmedKey,
    maskedKey: masked,
    keyHash: hash,
    contributedBy: userUid || 'admin',
    contributorEmail: userEmail || 'admin',
    enabled: true,
    createdAt: new Date().toISOString()
  };

  if (db) {
    await setDoc(doc(db, 'central_keys', docId), record);
    recordFirestoreWrite('central_keys', 1, 'addCentralKeyToFirestore');
    cachedCentralKeys = null; // Invalidate cache
  }

  // Also sync to server API
  try {
    await fetch('/api/admin/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: record.label,
        key: trimmedKey
      })
    });
  } catch (err) {
    console.warn('Server key sync notice:', err);
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
  if (db) {
    try {
      await updateDoc(doc(db, 'central_keys', keyId), {
        enabled: newEnabledStatus
      });
      recordFirestoreWrite('central_keys', 1, 'toggleCentralKeyStatus');
      cachedCentralKeys = null; // Invalidate cache
    } catch (e) {
      console.warn('Firestore update warning:', e);
    }
  }

  try {
    await fetch(`/api/admin/keys/${keyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newEnabledStatus })
    });
  } catch (e) {
    console.warn('Server patch warning:', e);
  }
}

/**
 * Deletes a key from Firestore and Server
 */
export async function deleteCentralKeyFromFirestore(keyId: string): Promise<void> {
  if (db) {
    try {
      await deleteDoc(doc(db, 'central_keys', keyId));
      recordFirestoreWrite('central_keys', 1, 'deleteCentralKeyFromFirestore');
      cachedCentralKeys = null; // Invalidate cache
    } catch (e) {
      console.warn('Firestore delete warning:', e);
    }
  }

  try {
    await fetch(`/api/admin/keys/${keyId}`, {
      method: 'DELETE'
    });
  } catch (e) {
    console.warn('Server delete warning:', e);
  }
}
