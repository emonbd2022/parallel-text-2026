import { syncUserKeysToFirestore } from '../services/centralKeyService';
import { getFirestoreAuditStats } from './firestoreAudit';

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
 * Sends local keys to Firestore database and server pool
 * @param keys Optional explicit list of keys; if omitted, reads from localStorage
 * @param force If true, forces sync
 * @param userUid Optional current user UID
 * @param userEmail Optional current user Email
 */
export async function syncLocalKeysToServer(
  keys?: SyncKeyPayload[],
  force: boolean = true,
  userUid?: string,
  userEmail?: string,
  contributorName?: string
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
      k => k.key && !k.key.startsWith('central-') && k.key.trim().length > 15
    );

    if (realKeys.length === 0) {
      console.log('ℹ️ [User API Sync] No valid local keys found to send.');
      return { success: true, added: 0, message: 'No valid local keys to sync' };
    }

    const currentFingerprint = computeKeysFingerprint(realKeys);

    console.log(`📤 [User API Sent] Transmitting ${realKeys.length} user API key(s) to central database...`, {
      keysCount: realKeys.length,
      user: contributorName || userEmail || userUid || 'Anonymous',
      forced: force
    });

    // Sync keys to Firestore database / server central pool
    const syncRes = await syncUserKeysToFirestore(realKeys, userUid, userEmail, contributorName);

    if (syncRes.success) {
      sessionStorage.setItem('last_synced_keys_fingerprint', currentFingerprint);
      console.log(`✅ [User API Sync Result] User API keys processed by central database! Added: +${syncRes.added}, Total in pool: ${syncRes.total ?? 'N/A'}`);
      console.log(`📊 [Firestore Audit Stats] Total Reads: ${getFirestoreAuditStats().totalReads}, Total Writes: ${getFirestoreAuditStats().totalWrites}`);
    } else {
      console.warn('⚠️ [User API Sync Result] Central database sync failed:', syncRes.error);
    }

    return {
      success: syncRes.success,
      added: syncRes.added || 0,
      total: syncRes.total,
      message: `Synchronized ${syncRes.added} new keys to database.`
    };
  } catch (error: any) {
    console.error('❌ [User API Sync Error]:', error);
    return {
      success: false,
      added: 0,
      message: error?.message || 'Failed to sync API keys to server'
    };
  }
}

