const fs = require('fs');

const code = `import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, serverTimestamp, addDoc, collection } from 'firebase/firestore';
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
  const [userData, setUserData] = useState<UserData | null>(() => {
    try {
      const cached = localStorage.getItem('cachedUserData');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData) {
      localStorage.setItem('cachedUserData', JSON.stringify(userData));
    }
  }, [userData]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          
          // Setup real-time listener for user data
          const unsubSnapshot = onSnapshot(userRef, async (docSnap) => {
            if (docSnap.exists()) {
              setUserData(docSnap.data() as UserData);
            } else {
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
                          message: \`New user signed up: \${currentUser.email}\`,
                          read: false,
                          createdAt: serverTimestamp()
                      });
                  } catch (e) {
                      console.error("Failed to notify admin", e);
                  }
              }
            }
          }, (err) => {
              console.error("Error listening to user data:", err);
          });
          
          if ((window as any)._userUnsub) {
              (window as any)._userUnsub();
          }
          (window as any)._userUnsub = unsubSnapshot;

        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserData(null);
        localStorage.removeItem('cachedUserData');
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
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
`;

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
