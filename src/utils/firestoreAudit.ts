/**
 * Development-only Firestore operation audit tracker.
 * Tracks reads and writes by collection and source.
 * Zero overhead in production, strictly in-memory (never persists to Firestore).
 */

interface AuditCounters {
  reads: Record<string, number>;
  writes: Record<string, number>;
  totalReads: number;
  totalWrites: number;
  lastLogged: number;
}

const auditState: AuditCounters = {
  reads: {},
  writes: {},
  totalReads: 0,
  totalWrites: 0,
  lastLogged: Date.now()
};

export function recordFirestoreRead(collection: string, count: number = 1, source: string = 'unknown') {
  auditState.reads[collection] = (auditState.reads[collection] || 0) + count;
  auditState.totalReads += count;
  logAudit(`[Firestore Audit: READ] +${count} from "${collection}" (source: ${source})`);
}

export function recordFirestoreWrite(collection: string, count: number = 1, source: string = 'unknown') {
  auditState.writes[collection] = (auditState.writes[collection] || 0) + count;
  auditState.totalWrites += count;
  logAudit(`[Firestore Audit: WRITE] +${count} to "${collection}" (source: ${source})`);
}

function logAudit(message: string) {
  if (process.env.NODE_ENV !== 'production' || typeof window !== 'undefined') {
    console.info(message, {
      totalReads: auditState.totalReads,
      totalWrites: auditState.totalWrites,
      byCollection: {
        reads: auditState.reads,
        writes: auditState.writes
      }
    });
  }
}

export function getFirestoreAuditStats() {
  return { ...auditState };
}

export function resetFirestoreAuditStats() {
  auditState.reads = {};
  auditState.writes = {};
  auditState.totalReads = 0;
  auditState.totalWrites = 0;
}

const QUOTA_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown when free-tier daily quota is hit

export function isFirestoreQuotaExhausted(): boolean {
  try {
    const ts = typeof window !== 'undefined' ? localStorage.getItem('firestore_quota_exhausted') : null;
    if (!ts) return false;
    const elapsed = Date.now() - parseInt(ts, 10);
    if (elapsed < QUOTA_COOLDOWN_MS) return true;
    localStorage.removeItem('firestore_quota_exhausted');
    return false;
  } catch {
    return false;
  }
}

export function markFirestoreQuotaExhausted() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('firestore_quota_exhausted', Date.now().toString());
    }
  } catch {}
}

export function handleFirestoreError(err: any, context: string = 'operation'): boolean {
  const isQuota = err?.code === 'resource-exhausted' || 
                  err?.message?.includes('Quota limit exceeded') || 
                  err?.message?.includes('quota metric') ||
                  err?.message?.includes('resource-exhausted');
  if (isQuota) {
    markFirestoreQuotaExhausted();
    console.warn(`[Firestore] Daily quota limit reached during ${context}. Gracefully switching to local mode.`);
    return true;
  }
  return false;
}
