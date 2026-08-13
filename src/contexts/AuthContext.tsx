import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
  maintenanceMode: boolean;
  notifications: any[];
  setNotifications: React.Dispatch<React.SetStateAction<any[]>>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userData: null, 
  loading: true, 
  setUserData: () => {},
  maintenanceMode: false,
  notifications: [],
  setNotifications: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cachedData = (() => {
    try {
      const cached = localStorage.getItem('cachedUserData');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  })();

  const [user, setUser] = useState<User | null>(cachedData ? { uid: cachedData.uid } as User : null);
  const [userData, setUserData] = useState<UserData | null>(cachedData);
  const [loading, setLoading] = useState(cachedData ? false : true);
  const [maintenanceMode] = useState(false);
  const [notifications, setNotifications] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('localNotifications');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Track the UID for which we have already performed the single initial fetch in this browser session
  const fetchedUidRef = useRef<string | null>(cachedData?.uid || null);

  useEffect(() => {
    if (userData) {
      localStorage.setItem('cachedUserData', JSON.stringify(userData));
    }
  }, [userData]);

  useEffect(() => {
    try {
      localStorage.setItem('localNotifications', JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // STRICT CHECK: If we have already fetched or initialized this UID in this session,
        // DO NOT perform any Firestore getDoc call. This prevents re-reads on token refresh,
        // tab focus, window re-focus, or component remount.
        if (fetchedUidRef.current === currentUser.uid) {
          setLoading(false);
          return;
        }

        fetchedUidRef.current = currentUser.uid;

        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userRef);
          
          if (docSnap.exists()) {
            setUserData(docSnap.data() as UserData);
          } else {
            // Initialize new user document (1 write for brand new user creation)
            const isFirstUser = currentUser.email === 'titaniumfact97@gmail.com' || currentUser.email === 'reactoremon2022@gmail.com';
            const newUserData: UserData = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              name: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              nickname: currentUser.displayName?.split(' ')[0] || 'User',
              credits: 100,
              unlimited: false,
              totalProcessedImages: 0,
              joinDate: new Date().toISOString(),
              blocked: false,
              role: isFirstUser ? 'admin' : 'user',
              plan: 'free',
            };
            
            await setDoc(userRef, newUserData);
            setUserData(newUserData);
          }
        } catch (error) {
          console.error("Error fetching user profile on login:", error);
          const isFirstUser = currentUser.email === 'titaniumfact97@gmail.com' || currentUser.email === 'reactoremon2022@gmail.com';
          const fallbackUserData: UserData = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            name: currentUser.displayName || '',
            photoURL: currentUser.photoURL || '',
            nickname: currentUser.displayName?.split(' ')[0] || 'User',
            credits: 100,
            unlimited: false,
            totalProcessedImages: 0,
            joinDate: new Date().toISOString(),
            blocked: false,
            role: isFirstUser ? 'admin' : 'user',
            plan: 'free',
          };
          setUserData(prev => prev || fallbackUserData);
        }
      } else {
        fetchedUidRef.current = null;
        setUserData(null);
        setNotifications([]);
        localStorage.removeItem('cachedUserData');
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, setUserData, maintenanceMode, notifications, setNotifications }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
