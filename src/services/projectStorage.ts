import { ProcessingItem } from '../types';

const DB_NAME = 'ParallelTextDB';
const STORE_NAME = 'project_store';
const KEY = 'current_session';
const METADATA_BACKUP_KEY = 'paralleltext_metadata_backup';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error("IndexedDB not supported"));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
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
      thumb: i.thumb // Preserves base64 thumbnail if available
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
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const cleanItems = items.map(i => ({
        ...i,
        file: null, // Avoid file handle serialization issues in certain browsers
        status: (i.status === 'processing' || i.status === 'compressing') ? 'pending' : i.status,
        assignedKeyId: undefined,
        errorMsg: i.status === 'error' ? i.errorMsg : undefined
      }));
      
      store.put(cleanItems, KEY);
      
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
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(KEY);
      
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
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(KEY);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    return Promise.resolve();
  }
};
