import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

let syncTimeout: any;

export const syncUserDataToCloud = (uid: string, data: any) => {
  if (!uid) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  
  const removeUndefined = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefined);
    return Object.entries(obj).reduce((acc: any, [key, value]) => {
      if (value !== undefined) {
        acc[key] = removeUndefined(value);
      }
      return acc;
    }, {});
  };

  syncTimeout = setTimeout(async () => {
    try {
      const cleanData = removeUndefined(data);
      const updates: any = {};
      Object.keys(cleanData).forEach(key => {
        updates[`appData.${key}`] = cleanData[key];
      });
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', uid), updates);
      }
    } catch (err) {
      console.error('Failed to sync to cloud:', err);
    }
  }, 2000); // 2-second debounce
};
