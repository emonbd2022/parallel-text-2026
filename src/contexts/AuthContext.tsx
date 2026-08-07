import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface UserData {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  nickname: string;
  credits: number;
  unlimited: boolean;
  totalProcessedImages: number;
  joinDate: string;
  blocked: boolean;
  role: 'admin' | 'user';
  plan?: 'free' | 'starter' | 'pro' | 'elite' | 'unlimited';
  planStartDate?: string;
  planEndDate?: string;
  appData?: any;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userData: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    let userUnsub: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userRef);
          
          if (!docSnap.exists()) {
            // Initialize user
            const isFirstUser = currentUser.email === 'titaniumfact97@gmail.com';
            const newUserData: Partial<UserData> = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              nickname: currentUser.displayName?.split(' ')[0] || 'User',
              credits: 100, // default credits
              unlimited: false,
              totalProcessedImages: 0,
              joinDate: new Date().toISOString(),
              blocked: false,
              role: isFirstUser ? 'admin' : 'user',
              plan: 'free',
            };
            
            await setDoc(userRef, newUserData);
            setUserData(newUserData as UserData);
            
            // Send admin notification
            if (!isFirstUser) {
                try {
                    await addDoc(collection(db, 'notifications'), {
                        targetUid: 'admin',
                        type: 'signup',
                        message: `New user signed up: ${currentUser.email}`,
                        read: false,
                        createdAt: serverTimestamp()
                    });
                } catch (e) {
                    console.error("Failed to notify admin", e);
                }
            }
          } else {
            // Set initial data
            setUserData(docSnap.data() as UserData);
            // Setup real-time listener for user data
            const unsubSnapshot = onSnapshot(userRef, (doc) => {
              if (doc.exists()) {
                setUserData(doc.data() as UserData);
              }
            }, (err) => { 
               console.error("Error listening to user data:", err);
            });
            // We need to clean this up, so store it.
            if ((window as any)._userUnsub) {
                (window as any)._userUnsub();
            }
            (window as any)._userUnsub = unsubSnapshot;
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          // Fallback so the app doesn't crash completely
          setUserData({
            uid: currentUser.uid,
            email: currentUser.email || '',
            name: currentUser.displayName || '',
            photoURL: currentUser.photoURL || '',
            nickname: currentUser.displayName?.split(' ')[0] || 'User',
            credits: 0,
            unlimited: false,
            totalProcessedImages: 0,
            joinDate: new Date().toISOString(),
            blocked: false,
            role: 'user',
            plan: 'free',
          });
        }
      } else {
        setUserData(null);
        if ((window as any)._userUnsub) {
            (window as any)._userUnsub();
            (window as any)._userUnsub = null;
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if ((window as any)._userUnsub) {
        (window as any)._userUnsub();
        (window as any)._userUnsub = null;
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
