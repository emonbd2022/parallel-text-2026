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
  setMaintenanceMode: React.Dispatch<React.SetStateAction<boolean>>;
  notifications: any[];
  setNotifications: React.Dispatch<React.SetStateAction<any[]>>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userData: null, 
  loading: true, 
  setUserData: () => {},
  maintenanceMode: false,
  setMaintenanceMode: () => {},
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
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('maintenanceMode') === 'true';
    } catch {
      return false;
    }
  });
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
  const fetchedSettingsRef = useRef<boolean>(false);

  useEffect(() => {
    if (fetchedSettingsRef.current) return;
    fetchedSettingsRef.current = true;

    getDoc(doc(db, 'settings', 'general'))
      .then((docSnap) => {
        if (docSnap.exists()) {
          const isMaint = docSnap.data()?.maintenanceMode === true;
          setMaintenanceMode(isMaint);
          try { localStorage.setItem('maintenanceMode', String(isMaint)); } catch {}
        }
      })
      .catch((err) => {
        console.warn("Could not check maintenance mode settings:", err);
      });
  }, []);

  useEffect(() => {
    if (userData) {
      try { localStorage.setItem('cachedUserData', JSON.stringify(userData)); } catch {}
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
        // Check local storage cache as well
        let hasLocalCache = false;
        try {
          const cachedStr = localStorage.getItem('cachedUserData');
          if (cachedStr) {
            const parsed = JSON.parse(cachedStr);
            if (parsed && parsed.uid === currentUser.uid) {
              hasLocalCache = true;
              if (!userData) setUserData(parsed);
            }
          }
        } catch {}

        // STRICT CHECK: If profile was already fetched or exists in cache/ref, 0 Firestore reads!
        if (fetchedUidRef.current === currentUser.uid || hasLocalCache) {
          fetchedUidRef.current = currentUser.uid;
          setLoading(false);
          return;
        }

        fetchedUidRef.current = currentUser.uid;

        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userRef);
          
          if (docSnap.exists()) {
            const d = docSnap.data();
            const isFirstUser = currentUser.email === 'titaniumfact97@gmail.com' || currentUser.email === 'reactoremon2022@gmail.com';
            const data: UserData = {
              uid: currentUser.uid,
              email: d.email || currentUser.email || '',
              name: d.name || currentUser.displayName || '',
              photoURL: d.photoURL || currentUser.photoURL || '',
              nickname: d.nickname || currentUser.displayName?.split(' ')[0] || 'User',
              credits: typeof d.credits === 'number' ? d.credits : 100,
              unlimited: !!d.unlimited,
              totalProcessedImages: typeof d.totalProcessedImages === 'number' ? d.totalProcessedImages : 0,
              joinDate: d.joinDate || new Date().toISOString(),
              blocked: !!d.blocked,
              role: d.role === 'admin' ? 'admin' : (isFirstUser ? 'admin' : 'user'),
              plan: d.plan || 'free',
              planStartDate: d.planStartDate,
              planEndDate: d.planEndDate,
            };
            setUserData(data);
            try { localStorage.setItem('cachedUserData', JSON.stringify(data)); } catch {}
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
            try { localStorage.setItem('cachedUserData', JSON.stringify(newUserData)); } catch {}
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
    <AuthContext.Provider value={{ user, userData, loading, setUserData, maintenanceMode, setMaintenanceMode, notifications, setNotifications }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
