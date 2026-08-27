import { syncUserKeysToFirestore } from '../services/centralKeyService';
import {
  getFirestoreAuditStats,
  recordSyncRequest,
  recordSyncPrevented,
  recordDuplicatePrevented
} from './firestoreAudit';

/**
 * Synchronization utility for API Keys to Central Pool / Firestore Database & Server
 * Strict Hard Performance Optimizations:
 * 1. Session-Once Synchronization: Does not resend keys if already synchronized in this session.
 * 2. Delta Synchronization: If new keys are added, sends ONLY the new un-synced keys.
 * 3. In-flight Request Deduplication: Multiple concurrent calls await the exact same Promise.
 * 4. Zero unnecessary network writes.
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

// Fast string hash for client-side key registry tracking
function simpleKeyHash(text: string): string {
  const clean = text.trim();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'kh_' + Math.abs(hash).toString(36) + '_' + clean.substring(0, 4) + clean.substring(clean.length - 4);
}

/**
 * Calculates a stable fingerprint for a list of API keys
 */
export function computeKeysFingerprint(keys: SyncKeyPayload[]): string {
  const normalized = keys
    .filter(k => k.key && !k.key.startsWith('central-') && k.key.trim().length > 0)
    .map(k => `${k.label.trim()}:::${simpleKeyHash(k.key)}`)
    .sort()
    .join('||');
  return normalized;
}

// In-flight sync promise lock to deduplicate concurrent calls
let inFlightSyncPromise: Promise<SyncResult> | null = null;

// Helper to get locally known synced key hashes
function getKnownSyncedHashes(userUid: string): Set<string> {
  const set = new Set<string>();
  try {
    const sessionData = sessionStorage.getItem(`synced_key_hashes_${userUid}`);
    if (sessionData) {
      const arr = JSON.parse(sessionData);
      if (Array.isArray(arr)) arr.forEach(h => set.add(h));
    }
  } catch {}
  try {
    const localData = localStorage.getItem(`synced_key_hashes_${userUid}`);
    if (localData) {
      const arr = JSON.parse(localData);
      if (Array.isArray(arr)) arr.forEach(h => set.add(h));
    }
  } catch {}
  return set;
}

// Helper to register newly synced key hashes
function markKeyHashesAsSynced(userUid: string, hashes: string[]) {
  try {
    const existing = getKnownSyncedHashes(userUid);
    hashes.forEach(h => existing.add(h));
    const arr = Array.from(existing);
    sessionStorage.setItem(`synced_key_hashes_${userUid}`, JSON.stringify(arr));
    localStorage.setItem(`synced_key_hashes_${userUid}`, JSON.stringify(arr));
  } catch {}
}

/**
 * Sends local keys to Firestore database and server pool with session-once and delta sync protection.
 * @param keys Optional explicit list of keys; if omitted, reads from localStorage
 * @param force If true, bypasses session fingerprint check (e.g. manual user force sync)
 * @param userUid Optional current user UID
 * @param userEmail Optional current user Email
 * @param contributorName Optional contributor display name
 */
export async function syncLocalKeysToServer(
  keys?: SyncKeyPayload[],
  force: boolean = false,
  userUid?: string,
  userEmail?: string,
  contributorName?: string
): Promise<SyncResult> {
  // If a synchronization is already in flight, await the existing request
  if (inFlightSyncPromise) {
    recordDuplicatePrevented('key_sync', 'In-flight synchronization promise shared');
    return await inFlightSyncPromise;
  }

  inFlightSyncPromise = (async () => {
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
        return { success: true, added: 0, message: 'No valid local keys to sync' };
      }

      const activeUid = userUid || 'anonymous';
      const allKeysFingerprint = computeKeysFingerprint(realKeys);
      const sessionSyncedFp = sessionStorage.getItem(`session_synced_fp_${activeUid}`);

      // 1. Session-Once Check: If exact set of keys was already synced in this browser session
      if (!force && sessionSyncedFp === allKeysFingerprint) {
        recordSyncPrevented('Exact key collection fingerprint already synchronized in this session');
        return {
          success: true,
          added: 0,
          message: 'Local keys already synchronized in this session'
        };
      }

      // 2. Delta Check: Identify only genuinely un-synced keys
      const knownSynced = getKnownSyncedHashes(activeUid);
      const newUnsyncedKeys: SyncKeyPayload[] = [];
      const newKeyHashes: string[] = [];

      for (const k of realKeys) {
        const hash = simpleKeyHash(k.key);
        if (force || !knownSynced.has(hash)) {
          newUnsyncedKeys.push(k);
          newKeyHashes.push(hash);
        }
      }

      if (!force && newUnsyncedKeys.length === 0) {
        // All individual keys are already known as synced
        sessionStorage.setItem(`session_synced_fp_${activeUid}`, allKeysFingerprint);
        recordSyncPrevented('All individual keys already present in synchronized registry');
        return {
          success: true,
          added: 0,
          message: 'All keys previously synchronized'
        };
      }

      // 3. Transmit only the delta / new keys to Central Database
      const keysToSend = force ? realKeys : newUnsyncedKeys;
      const maskedCount = keysToSend.length;
      
      console.log(`📤 [User API Sync] Synchronizing ${maskedCount} key(s) to central registry...`, {
        totalLocalKeys: realKeys.length,
        newKeysToSend: maskedCount,
        forced: force
      });

      recordSyncRequest(maskedCount, force ? 'manual_force' : 'delta_sync');

      const syncRes = await syncUserKeysToFirestore(keysToSend, userUid, userEmail, contributorName);

      if (syncRes.success) {
        sessionStorage.setItem(`session_synced_fp_${activeUid}`, allKeysFingerprint);
        markKeyHashesAsSynced(activeUid, realKeys.map(k => simpleKeyHash(k.key)));
        
        console.log(`✅ [User API Sync Result] Processed by central database! Added: +${syncRes.added}, Total pool: ${syncRes.total ?? 'N/A'}`);
        console.log(`📊 [Audit Stats] Reads: ${getFirestoreAuditStats().totalReads}, Writes: ${getFirestoreAuditStats().totalWrites}, Syncs: ${getFirestoreAuditStats().syncRequests}, Prevented: ${getFirestoreAuditStats().syncsPrevented}`);
      } else {
        console.warn('⚠️ [User API Sync Result] Central database sync notice:', syncRes.error);
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
    } finally {
      inFlightSyncPromise = null;
    }
  })();

  return await inFlightSyncPromise;
}
