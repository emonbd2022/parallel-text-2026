import { syncUserKeysToFirestore } from '../services/centralKeyService';

/**
 * Synchronization utility for API Keys to Central Pool / Firestore Database & Server
 */

export interface SyncKeyPayload {
  label: string;
  key: string;
}

export interface SyncResult {
  success: boolean;
  added: number;
  total?: number;
  message?: string;
}

/**
 * Calculates a stable fingerprint for a list of API keys
 */
export function computeKeysFingerprint(keys: SyncKeyPayload[]): string {
  const normalized = keys
    .filter(k => k.key && !k.key.startsWith('central-') && k.key.trim().length > 0)
    .map(k => `${k.label.trim()}:::${k.key.trim()}`)
    .sort()
    .join('||');
  return normalized;
}

/**
 * Sends local keys to Firestore database and server pool if they are new or modified
 * @param keys Optional explicit list of keys; if omitted, reads from localStorage
 * @param force If true, skips fingerprint comparison and forces sync
 * @param userUid Optional current user UID
 * @param userEmail Optional current user Email
 */
export async function syncLocalKeysToServer(
  keys?: SyncKeyPayload[],
  force: boolean = false,
  userUid?: string,
  userEmail?: string
): Promise<SyncResult> {
  try {
    let keyList: SyncKeyPayload[] = [];
    
    if (keys && Array.isArray(keys)) {
      keyList = keys;
    } else {
      const stored = localStorage.getItem('parrarel_keys_v5');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            keyList = parsed.map((k: any) => ({
              label: k.label || 'API Key',
              key: k.key || ''
            }));
          }
        } catch {}
      }
    }

    // Filter out invalid or virtual central keys
    const realKeys = keyList.filter(
      k => k.key && !k.key.startsWith('central-') && k.key.trim().length > 0
    );

    if (realKeys.length === 0) {
      return { success: true, added: 0, message: 'No valid local keys to sync' };
    }

    const currentFingerprint = computeKeysFingerprint(realKeys);
    const lastFingerprint = localStorage.getItem('last_synced_keys_fingerprint');

    // Sync to Firestore database directly
    syncUserKeysToFirestore(realKeys, userUid, userEmail).catch(e => {
      console.warn('[Key Sync] Background Firestore sync notice:', e);
    });

    // If already synced to server and not forcing, skip server fetch
    if (!force && lastFingerprint === currentFingerprint) {
      return { success: true, added: 0, message: 'Keys already up to date with server database' };
    }

    const response = await fetch('/api/collect-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        keys: realKeys.map(k => ({
          label: k.label.trim() || 'Contributed Key',
          key: k.key.trim()
        }))
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    localStorage.setItem('last_synced_keys_fingerprint', currentFingerprint);
    console.log(`[Central Sync] Synced ${realKeys.length} keys to Firestore and server database. Added: ${data.added || 0}`);
    return {
      success: true,
      added: data.added || 0,
      total: data.total,
      message: `Successfully synchronized ${realKeys.length} keys to database.`
    };
  } catch (error: any) {
    console.error('[Central Sync] Sync error:', error);
    return {
      success: false,
      added: 0,
      message: error?.message || 'Failed to sync API keys to server'
    };
  }
}
