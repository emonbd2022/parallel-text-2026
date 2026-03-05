import { ProcessingItem } from '../types';

const DB_NAME = 'ParallelTextDB';
const STORE_NAME = 'project_store';
const KEY = 'current_session';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // Check if indexedDB is supported
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
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Clean up items before saving:
    // 1. Reset 'processing' or 'compressing' statuses to 'pending' so they aren't stuck on reload.
    // 2. Clear error messages that might be transient.
    const cleanItems = items.map(i => ({
      ...i,
      status: (i.status === 'processing' || i.status === 'compressing') ? 'pending' : i.status,
      assignedKeyId: undefined, // Reset assigned key
      errorMsg: i.status === 'error' ? i.errorMsg : undefined // Keep error if it was a hard error
    }));
    
    store.put(cleanItems, KEY);
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const loadProject = async (): Promise<ProcessingItem[] | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(KEY);
    
    request.onsuccess = () => {
      resolve(request.result as ProcessingItem[] || null);
    };
    request.onerror = () => reject(request.error);
  });
};

export const clearProject = async (): Promise<void> => {
  try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(KEY);
        
        // Resolve on transaction completion or error (to ensure UI doesn't hang)
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => {
            console.warn("Error clearing project from DB:", e);
            resolve();
        };
      });
  } catch (e) {
      console.warn("Could not open DB to clear project:", e);
      return Promise.resolve();
  }
};
