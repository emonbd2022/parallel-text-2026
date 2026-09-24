import { ProcessingItem, HistoryRecord } from '../types';

const DB_NAME = 'ParallelTextDB';
const DB_VERSION = 2;
const STORE_PROJECT = 'project_store';
const STORE_HISTORY = 'export_history_store';
const KEY_CURRENT_SESSION = 'current_session';
const METADATA_BACKUP_KEY = 'paralleltext_metadata_backup';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error("IndexedDB not supported"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECT)) {
        db.createObjectStore(STORE_PROJECT);
      }
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveProject = async (items: ProcessingItem[]): Promise<void> => {
  // 1. Immediately save lightweight metadata to localStorage as instant sync backup
  try {
    const metaBackup = items.map(i => ({
      id: i.id,
      name: i.name,
      size: i.size,
      status: (i.status === 'processing' || i.status === 'compressing') ? 'pending' : i.status,
      title: i.title || '',
      keywords: i.keywords || '',
      category: i.category || '',
      attempts: i.attempts || 0,
      exported: !!i.exported,
      usedModel: i.usedModel,
      errorMsg: i.status === 'error' ? i.errorMsg : undefined,
      thumb: i.thumb
    }));
    localStorage.setItem(METADATA_BACKUP_KEY, JSON.stringify(metaBackup));
  } catch (e) {
    // If localStorage quota exceeded due to large thumbs, strip thumb for backup
    try {
      const lightweight = items.map(i => ({
        id: i.id,
        name: i.name,
        size: i.size,
        status: (i.status === 'processing' || i.status === 'compressing') ? 'pending' : i.status,
        title: i.title || '',
        keywords: i.keywords || '',
        category: i.category || '',
        attempts: i.attempts || 0,
        exported: !!i.exported,
        usedModel: i.usedModel
      }));
      localStorage.setItem(METADATA_BACKUP_KEY, JSON.stringify(lightweight));
    } catch {}
  }

  // 2. Persist full objects (including Blob data) in IndexedDB
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECT, 'readwrite');
      const store = tx.objectStore(STORE_PROJECT);
      
      const cleanItems = items.map(i => ({
        ...i,
        file: null, // Avoid file handle serialization issues in certain browsers
        status: (i.status === 'processing' || i.status === 'compressing') ? 'pending' : i.status,
        assignedKeyId: undefined,
        errorMsg: i.status === 'error' ? i.errorMsg : undefined
      }));
      
      store.put(cleanItems, KEY_CURRENT_SESSION);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("IndexedDB save warning:", err);
  }
};

export const loadProject = async (): Promise<ProcessingItem[] | null> => {
  try {
    const db = await openDB();
    const idbResult = await new Promise<ProcessingItem[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECT, 'readonly');
      const store = tx.objectStore(STORE_PROJECT);
      const request = store.get(KEY_CURRENT_SESSION);
      
      request.onsuccess = () => {
        resolve((request.result as ProcessingItem[]) || null);
      };
      request.onerror = () => reject(request.error);
    });

    if (idbResult && idbResult.length > 0) {
      return idbResult;
    }
  } catch (e) {
    console.warn("IndexedDB load error, checking localStorage fallback:", e);
  }

  // Fallback: Check localStorage metadata backup
  try {
    const local = localStorage.getItem(METADATA_BACKUP_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(p => ({
          ...p,
          file: null,
          blob: null,
          thumb: p.thumb || null,
          failedKeyIds: [],
        })) as ProcessingItem[];
      }
    }
  } catch {}

  return null;
};

export const clearProject = async (): Promise<void> => {
  try {
    localStorage.removeItem(METADATA_BACKUP_KEY);
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PROJECT, 'readwrite');
      const store = tx.objectStore(STORE_PROJECT);
      const request = store.delete(KEY_CURRENT_SESSION);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    return Promise.resolve();
  }
};

/**
 * Persists CSV export history records in IndexedDB to avoid localStorage 5MB size limits
 */
export const saveExportHistoryToIDB = async (record: HistoryRecord): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_HISTORY, 'readwrite');
    const store = tx.objectStore(STORE_HISTORY);
    store.put(record);
  } catch (e) {
    console.warn('Could not persist export record to IndexedDB:', e);
  }
};

/**
 * Loads CSV export history from IndexedDB
 */
export const loadExportHistoryFromIDB = async (): Promise<HistoryRecord[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_HISTORY, 'readonly');
      const store = tx.objectStore(STORE_HISTORY);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};
