import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

/**
 * Computes a browser-compatible SHA-256 hash string for deduplication
 */
export async function computeKeySha256(text: string): Promise<string> {
  const trimmed = text.trim();
  try {
    if (window.crypto && window.crypto.subtle) {
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
 * Synchronizes user local API keys into the Firestore `central_keys` collection
 * AND informs the server API so both Firestore and server pool have the keys.
 */
export async function syncUserKeysToFirestore(
  keys: { label: string; key: string }[],
  userUid?: string,
  userEmail?: string
): Promise<{ success: boolean; total: number; error?: string }> {
  try {
    const validKeys = keys.filter(
      k => k.key && !k.key.startsWith('central-') && k.key.trim().length > 5
    );

    if (validKeys.length === 0) {
      return { success: true, total: 0 };
    }

    if (!db) {
      console.warn('[Central Key Service] Firestore db is not initialized yet');
    } else {
      // Save each valid key into Firestore central_keys collection
      for (const item of validKeys) {
        const trimmedKey = item.key.trim();
        const hash = await computeKeySha256(trimmedKey);
        const docId = `ck_${hash.substring(0, 24)}`;
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
        } catch (fsErr) {
          console.warn('[Central Key Service] Firestore write notice:', fsErr);
        }
      }
    }

    // Also push to backend server pool for server-side generation workers
    try {
      await fetch('/api/collect-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keys: validKeys.map(k => ({
            label: k.label.trim() || 'User Contributed Key',
            key: k.key.trim()
          }))
        })
      });
    } catch (apiErr) {
      console.warn('[Central Key Service] Server sync warning:', apiErr);
    }

    return { success: true, total: validKeys.length };
  } catch (error: any) {
    console.error('[Central Key Service] Sync error:', error);
    return { success: false, total: 0, error: error?.message || 'Failed to sync keys' };
  }
}

/**
 * Fetches all central API keys from Firestore (with server fallback if needed)
 */
export async function fetchCentralKeysFromFirestore(): Promise<CentralKeyRecord[]> {
  try {
    if (db) {
      const q = query(collection(db, 'central_keys'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(d => ({
          ...d.data(),
          id: d.id
        } as CentralKeyRecord));
      }
    }
  } catch (e) {
    console.warn('[Central Key Service] Firestore fetch warning, trying server endpoint:', e);
  }

  // Server endpoint fallback
  try {
    const res = await fetch('/api/admin/keys');
    if (res.ok) {
      const serverKeys = await res.json();
      if (Array.isArray(serverKeys)) {
        return serverKeys.map((sk: any) => ({
          id: sk.id,
          label: sk.label,
          key: '',
          maskedKey: sk.maskedKey || '••••••••',
          keyHash: sk.id,
          contributedBy: 'server',
          enabled: sk.enabled !== false,
          createdAt: sk.createdAt || new Date().toISOString()
        }));
      }
    }
  } catch (e) {
    console.error('[Central Key Service] Server fetch error:', e);
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
