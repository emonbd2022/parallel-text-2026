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
            };
            
            await setDoc(userRef, newUserData);
            setUserData(newUserData as UserData);
          } else {
            // Setup real-time listener for user data
            onSnapshot(userRef, (doc) => {
              if (doc.exists()) {
                setUserData(doc.data() as UserData);
              }
            }, (err) => {
               console.error("Error listening to user data:", err);
            });
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
          });
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
