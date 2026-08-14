import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userData: null, 
  loading: true, 
  setUserData: () => {},
  maintenanceMode: false,
  setMaintenanceMode: () => {},
  notifications: [],
  setNotifications: () => {},
  logout: async () => {}
});

// Cache helpers to store per-user data as well as the active cachedUserData
const getUserDataFromCache = (uid?: string): UserData | null => {
  try {
    if (uid) {
      const userSpecific = localStorage.getItem(`userCache_${uid}`);
      if (userSpecific) return JSON.parse(userSpecific);
    }
    const general = localStorage.getItem('cachedUserData');
    if (general) {
      const parsed = JSON.parse(general);
      if (!uid || parsed.uid === uid) return parsed;
    }
  } catch {}
  return null;
};

const saveUserDataToCache = (data: UserData) => {
  try {
    if (data?.uid) {
      localStorage.setItem(`userCache_${data.uid}`, JSON.stringify(data));
      localStorage.setItem('cachedUserData', JSON.stringify(data));
    }
  } catch {}
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const cachedData = getUserDataFromCache();

  const [user, setUser] = useState<User | null>(cachedData ? { uid: cachedData.uid } as User : null);
  const [userData, setUserData] = useState<UserData | null>(cachedData);
  const [loading, setLoading] = useState<boolean>(false);
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

  // Guard to ensure strictly 1 real-time Firestore fetch occurs after each page reload/initial auth
  const hasPerformedPageReloadFetchRef = useRef<boolean>(false);
  const fetchedSettingsRef = useRef<boolean>(false);

  useEffect(() => {
    if (fetchedSettingsRef.current || !db) return;
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

  // Whenever userData changes, keep cache continuously updated
  useEffect(() => {
    if (userData) {
      saveUserDataToCache(userData);
    }
  }, [userData]);

  useEffect(() => {
    try {
      localStorage.setItem('localNotifications', JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  const logout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("Sign out error:", e);
    }
    // Explicitly preserve userCache_{uid}, cachedUserData, configuration, and apiKeys in localStorage!
    setUser(null);
    setUserData(null);
    setNotifications([]);
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Step 1: Immediately hydrate from cache so the user instantly sees their data
        const localCached = getUserDataFromCache(currentUser.uid);
        if (localCached) {
          setUserData(localCached);
        }

        // Step 2: Exactly ONE real-time read after each page reload to check if user data changed in Firestore
        if (!hasPerformedPageReloadFetchRef.current && db) {
          hasPerformedPageReloadFetchRef.current = true;

          try {
            const userRef = doc(db, 'users', currentUser.uid);
            const docSnap = await getDoc(userRef);
            
            if (docSnap.exists()) {
              const d = docSnap.data();
              const isFirstUser = currentUser.email === 'titaniumfact97@gmail.com' || currentUser.email === 'reactoremon2022@gmail.com';
              const serverData: UserData = {
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

              // Update state & cache if data is changed or freshly fetched
              setUserData(prev => {
                const isDifferent = !prev || 
                  prev.credits !== serverData.credits ||
                  prev.totalProcessedImages !== serverData.totalProcessedImages ||
                  prev.plan !== serverData.plan ||
                  prev.blocked !== serverData.blocked ||
                  prev.nickname !== serverData.nickname ||
                  prev.role !== serverData.role ||
                  prev.unlimited !== serverData.unlimited;

                if (isDifferent) {
                  saveUserDataToCache(serverData);
                  return serverData;
                }
                return prev;
              });
            } else {
              // Create default doc if missing
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
              saveUserDataToCache(newUserData);
            }
          } catch (error) {
            console.error("Error checking user profile on reload:", error);
          }
        }
      } else {
        // User logged out: Reset current user state but keep persisted cache in localStorage
        setUser(null);
        setUserData(null);
        setNotifications([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, setUserData, maintenanceMode, setMaintenanceMode, notifications, setNotifications, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
