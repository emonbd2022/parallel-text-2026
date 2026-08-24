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
 * Synchronizes user local API keys into the Central API pool
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
      const docId = `ck_${hash.substring(0, 24)}`;
      keysToSync.push({ item, hash, docId });
    }

    let addedCount = 0;

    // 1. Sync to server-side registry (which handles server memory & encryption & file persistence)
    try {
      const res = await fetch('/api/collect-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributedBy: userUid || 'user',
          contributorEmail: userEmail || '',
          keys: keysToSync.map(k => ({
            label: k.item.label || 'User Contributed Key',
            key: k.item.key
          }))
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          addedCount = data.added || 0;
        }
      }
    } catch (serverErr) {
      console.warn('[Central Key Service] Server collect-keys notice:', serverErr);
    }

    // Update local cache of synced hashes
    try {
      keysToSync.forEach(k => syncedSet.add(k.hash));
      localStorage.setItem(registryKey, JSON.stringify(Array.from(syncedSet)));
      localStorage.setItem('synced_key_hashes_v1', JSON.stringify(Array.from(syncedSet)));
    } catch {}

    // Invalidate client cache if keys were added
    cachedCentralKeys = null;

    return { success: true, total: validKeys.length, added: addedCount };
  } catch (error: any) {
    console.error('[Central Key Service] Sync error:', error);
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

  if (!forceRefresh && clientFetchPromise) {
    return await clientFetchPromise;
  }

  clientFetchPromise = (async () => {
    try {
      const res = await fetch(`/api/central-keys-pool${forceRefresh ? '?refresh=true' : ''}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success && Array.isArray(data.keys)) {
            const list: CentralKeyRecord[] = data.keys.map((sk: any, idx: number) => {
              const nodeKey = sk.id || `central-${idx}`;
              return {
                id: nodeKey,
                label: sk.label || `Central Pool Node ${idx + 1}`,
                key: nodeKey,
                maskedKey: '••••••••',
                keyHash: nodeKey,
                contributedBy: 'central-pool',
                enabled: true,
                createdAt: new Date().toISOString()
              };
            });
            cachedCentralKeys = list;
            lastCentralKeysFetchTime = Date.now();
            return list;
          }
        }
      }
    } catch (e) {
      console.warn('[Central Key Service] Server pool endpoint notice:', e);
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
  try {
    const url = forceRefresh ? '/api/admin/keys/refresh' : '/api/admin/keys';
    const method = forceRefresh ? 'POST' : 'GET';
    const res = await fetch(url, { method });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.keys || []);
      return list.map((k: any) => ({
        id: k.id,
        label: k.label || 'Central Key',
        key: '',
        maskedKey: k.maskedKey || '••••••••',
        keyHash: k.id,
        contributedBy: k.contributedBy || 'central',
        contributorEmail: k.contributorEmail || '',
        enabled: k.enabled !== false,
        createdAt: k.createdAt || new Date().toISOString()
      }));
    }
  } catch (e) {
    console.warn('[Central Key Service] Error fetching admin keys from server:', e);
  }

  // Fallback to pool if server admin endpoint unavailable
  return await fetchCentralKeysFromFirestore(forceRefresh);
}

/**
 * Adds a new Central Key to the server central registry
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

  const res = await fetch('/api/admin/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: label.trim() || 'Central Key',
      key: trimmedKey,
      contributedBy: userUid || 'admin',
      contributorEmail: userEmail || 'admin'
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || 'Failed to add central key');
  }

  const newKeyData = await res.json();
  cachedCentralKeys = null; // Invalidate client cache

  return {
    id: newKeyData.id || docId,
    label: label.trim() || 'Central Key',
    key: '',
    maskedKey: masked,
    keyHash: hash,
    contributedBy: userUid || 'admin',
    contributorEmail: userEmail || 'admin',
    enabled: true,
    createdAt: new Date().toISOString()
  };
}

/**
 * Toggles a key enabled/disabled status in Server registry
 */
export async function toggleCentralKeyStatus(
  keyId: string,
  newEnabledStatus: boolean
): Promise<void> {
  cachedCentralKeys = null; // Invalidate client cache
  const res = await fetch(`/api/admin/keys/${keyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: newEnabledStatus })
  });
  if (!res.ok) {
    throw new Error('Failed to toggle key status');
  }
}

/**
 * Deletes a key from Server registry
 */
export async function deleteCentralKeyFromFirestore(keyId: string): Promise<void> {
  cachedCentralKeys = null; // Invalidate client cache
  const res = await fetch(`/api/admin/keys/${keyId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error('Failed to delete central key');
  }
}
