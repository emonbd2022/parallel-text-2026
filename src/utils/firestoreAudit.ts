/**
 * Comprehensive Safe Diagnostics and Firestore Operation Audit Tracker.
 * Tracks reads, writes, synchronization requests, pool fetches, cache hits,
 * and duplicate request prevention across the application.
 * Zero overhead in production, strictly in-memory (never persists secrets or logs plaintext keys).
 */

export interface PerformanceDiagnostics {
  totalReads: number;
  totalWrites: number;
  syncRequests: number;
  syncsPrevented: number;
  centralPoolFetches: number;
  centralFetchesPrevented: number;
  sessionHits: number;
  duplicatesPrevented: number;
  readsByCollection: Record<string, number>;
  writesByCollection: Record<string, number>;
  recentEvents: Array<{
    timestamp: string;
    type: 'READ' | 'WRITE' | 'SYNC' | 'SYNC_PREVENTED' | 'CENTRAL_FETCH' | 'CENTRAL_PREVENTED' | 'CACHE_HIT' | 'DEDUP_LOCK';
    message: string;
  }>;
}

const auditState = {
  reads: {} as Record<string, number>,
  writes: {} as Record<string, number>,
  totalReads: 0,
  totalWrites: 0,
  syncRequests: 0,
  syncsPrevented: 0,
  centralPoolFetches: 0,
  centralFetchesPrevented: 0,
  sessionHits: 0,
  duplicatesPrevented: 0,
  recentEvents: [] as Array<{
    timestamp: string;
    type: 'READ' | 'WRITE' | 'SYNC' | 'SYNC_PREVENTED' | 'CENTRAL_FETCH' | 'CENTRAL_PREVENTED' | 'CACHE_HIT' | 'DEDUP_LOCK';
    message: string;
  }>
};

function pushEvent(type: any, message: string) {
  const event = {
    timestamp: new Date().toISOString(),
    type,
    message
  };
  auditState.recentEvents.push(event);
  if (auditState.recentEvents.length > 100) {
    auditState.recentEvents.shift();
  }
}

export function recordFirestoreRead(collection: string, count: number = 1, source: string = 'unknown') {
  auditState.reads[collection] = (auditState.reads[collection] || 0) + count;
  auditState.totalReads += count;
  pushEvent('READ', `Firestore READ +${count} from "${collection}" (source: ${source})`);
  logAudit(`[Firestore Audit: READ] +${count} from "${collection}" (source: ${source})`);
}

export function recordFirestoreWrite(collection: string, count: number = 1, source: string = 'unknown') {
  auditState.writes[collection] = (auditState.writes[collection] || 0) + count;
  auditState.totalWrites += count;
  pushEvent('WRITE', `Firestore WRITE +${count} to "${collection}" (source: ${source})`);
  logAudit(`[Firestore Audit: WRITE] +${count} to "${collection}" (source: ${source})`);
}

export function recordSyncRequest(keysCount: number, source: string = 'unknown') {
  auditState.syncRequests += 1;
  pushEvent('SYNC', `Key synchronization executed (+${keysCount} keys, source: ${source})`);
  logAudit(`[Key Sync Audit] Executed network synchronization: ${keysCount} key(s) (source: ${source})`);
}

export function recordSyncPrevented(reason: string) {
  auditState.syncsPrevented += 1;
  auditState.duplicatesPrevented += 1;
  pushEvent('SYNC_PREVENTED', `Key synchronization prevented: ${reason}`);
  logAudit(`[Key Sync Audit: DEDUP] Skipped redundant key sync: ${reason}`);
}

export function recordCentralFetch(isNetworkCall: boolean, reason: string = 'mode_activation') {
  if (isNetworkCall) {
    auditState.centralPoolFetches += 1;
    pushEvent('CENTRAL_FETCH', `Central Pool fetched from server (${reason})`);
    logAudit(`[Central Pool Audit] Network fetch executed (${reason})`);
  } else {
    auditState.centralFetchesPrevented += 1;
    auditState.sessionHits += 1;
    pushEvent('CENTRAL_PREVENTED', `Central Pool served from RAM/session cache (${reason})`);
    logAudit(`[Central Pool Audit: CACHE HIT] Served from session RAM (${reason})`);
  }
}

export function recordDuplicatePrevented(category: string, reason: string) {
  auditState.duplicatesPrevented += 1;
  pushEvent('DEDUP_LOCK', `Duplicate request prevented for ${category}: ${reason}`);
  logAudit(`[Single-Flight Lock] Duplicate request prevented for ${category}: ${reason}`);
}

export function recordSessionHit(category: string) {
  auditState.sessionHits += 1;
  pushEvent('CACHE_HIT', `Session memory hit for ${category}`);
}

function logAudit(message: string) {
  if (process.env.NODE_ENV !== 'production' || typeof window !== 'undefined') {
    console.info(message, {
      totalReads: auditState.totalReads,
      totalWrites: auditState.totalWrites,
      syncRequests: auditState.syncRequests,
      syncsPrevented: auditState.syncsPrevented,
      centralPoolFetches: auditState.centralPoolFetches,
      centralFetchesPrevented: auditState.centralFetchesPrevented,
      sessionHits: auditState.sessionHits,
      duplicatesPrevented: auditState.duplicatesPrevented
    });
  }
}

export function getFirestoreAuditStats(): PerformanceDiagnostics {
  return {
    totalReads: auditState.totalReads,
    totalWrites: auditState.totalWrites,
    syncRequests: auditState.syncRequests,
    syncsPrevented: auditState.syncsPrevented,
    centralPoolFetches: auditState.centralPoolFetches,
    centralFetchesPrevented: auditState.centralFetchesPrevented,
    sessionHits: auditState.sessionHits,
    duplicatesPrevented: auditState.duplicatesPrevented,
    readsByCollection: { ...auditState.reads },
    writesByCollection: { ...auditState.writes },
    recentEvents: [...auditState.recentEvents]
  };
}

export function resetFirestoreAuditStats() {
  auditState.reads = {};
  auditState.writes = {};
  auditState.totalReads = 0;
  auditState.totalWrites = 0;
  auditState.syncRequests = 0;
  auditState.syncsPrevented = 0;
  auditState.centralPoolFetches = 0;
  auditState.centralFetchesPrevented = 0;
  auditState.sessionHits = 0;
  auditState.duplicatesPrevented = 0;
  auditState.recentEvents = [];
}
