import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

let syncTimeout: any;

export const syncUserDataToCloud = (uid: string, data: any) => {
  if (!uid) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        appData: data
      });
    } catch (err) {
      console.error('Failed to sync to cloud:', err);
    }
  }, 2000); // 2-second debounce
};
