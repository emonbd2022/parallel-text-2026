import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;
let auth;
let db;

try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    // Only pass databaseId if it exists in env
    const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
    
    const firestoreSettings = {};
    
    if (dbId) {
      db = initializeFirestore(app, firestoreSettings, dbId);
    } else {
      db = initializeFirestore(app, firestoreSettings);
    }
    

    
    
    auth = getAuth(app);
  }
} catch (error) {
  console.error("Firebase initialization error", error);
}

export { app, auth, db };

export const signInWithGoogle = async () => {
  if (!auth) {
    throw new Error("Firebase is not configured. Please set the VITE_FIREBASE_* environment variables.");
  }
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
