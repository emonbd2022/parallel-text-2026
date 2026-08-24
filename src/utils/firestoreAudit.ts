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
