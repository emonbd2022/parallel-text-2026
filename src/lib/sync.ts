import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export const syncUserDataToCloud = async (uid: string, appData: any) => {
    if (!uid) return;
    try {
        await updateDoc(doc(db, 'users', uid), { appData });
    } catch (error) {
        console.warn("Failed to sync app data:", error);
    }
};
