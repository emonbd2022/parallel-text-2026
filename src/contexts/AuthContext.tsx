import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, writeBatch } from 'firebase/firestore';
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

export interface AppNotification {
  id: string;
  targetUid: string;
  type: string;
  message: string;
  userName?: string;
  userEmail?: string;
  createdAt: string;
  read: boolean;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
  maintenanceMode: boolean;
  setMaintenanceMode: React.Dispatch<React.SetStateAction<boolean>>;
  notifications: AppNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
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
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
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
  const hasFetchedAdminNotifsRef = useRef<boolean>(false);
  const sentSignupNotifsRef = useRef<Set<string>>(new Set());

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

  // One-shot fetch admin notifications strictly once per session if user is admin
  // Cached locally after first fetch so remounting/reopening Admin Panel never repeats query unnecessarily
  useEffect(() => {
    if (!userData || userData.role !== 'admin' || !db || hasFetchedAdminNotifsRef.current) return;
    
    // Check session cache to avoid repeating query on route changes / component remounts
    const sessionFetched = sessionStorage.getItem('adminNotifsFetched') === 'true';
    if (sessionFetched) {
      hasFetchedAdminNotifsRef.current = true;
      try {
        const cached = localStorage.getItem('cachedAdminNotifs');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setNotifications(parsed);
            return;
          }
        }
      } catch {}
    }

    hasFetchedAdminNotifsRef.current = true;
    try { sessionStorage.setItem('adminNotifsFetched', 'true'); } catch {}

    const notifsQuery = query(
      collection(db, 'notifications'),
      where('targetUid', '==', 'admin'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    getDocs(notifsQuery)
      .then((snap) => {
        const readIds: string[] = JSON.parse(localStorage.getItem('readNotifs') || '[]');
        const fetchedNotifs: AppNotification[] = snap.docs.map(d => {
          const data = d.data();
          const notifId = data.id || d.id;
          return {
            id: notifId,
            targetUid: data.targetUid || 'admin',
            type: data.type || 'signup',
            message: data.message || `New User Signup\nName: ${data.userName || 'User'}\nEmail: ${data.userEmail || ''}`,
            userName: data.userName,
            userEmail: data.userEmail,
            createdAt: data.createdAt || new Date().toISOString(),
            read: readIds.includes(notifId) || data.read === true
          };
        });

        setNotifications(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const combined = [...prev];
          fetchedNotifs.forEach(fn => {
            if (!existingIds.has(fn.id)) {
              combined.push(fn);
            }
          });
          const sorted = combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          try { localStorage.setItem('cachedAdminNotifs', JSON.stringify(sorted)); } catch {}
          return sorted;
        });
      })
      .catch((err) => {
        console.warn("Could not load admin notifications:", err);
      });
  }, [userData?.role]);

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
              // Genuinely NEW user: create initial user document and admin notification atomically
              const isFirstUser = currentUser.email === 'titaniumfact97@gmail.com' || currentUser.email === 'reactoremon2022@gmail.com';
              const userName = currentUser.displayName || 'User';
              const userEmail = currentUser.email || '';
              const nowISO = new Date().toISOString();

              const newUserData: UserData = {
                uid: currentUser.uid,
                email: userEmail,
                name: userName,
                photoURL: currentUser.photoURL || '',
                nickname: userName.split(' ')[0] || 'User',
                credits: 100,
                unlimited: false,
                totalProcessedImages: 0,
                joinDate: nowISO,
                blocked: false,
                role: isFirstUser ? 'admin' : 'user',
                plan: 'free',
              };

              const notifId = `signup_${currentUser.uid}`;
              const notifRef = doc(db, 'notifications', notifId);
              const notifData: AppNotification = {
                id: notifId,
                targetUid: 'admin',
                type: 'signup',
                message: `New User Signup\nName: ${userName}\nEmail: ${userEmail}`,
                userName,
                userEmail,
                createdAt: nowISO,
                read: false,
              };

              const notifKey = `signup_notif_sent_${currentUser.uid}`;
              sentSignupNotifsRef.current.add(currentUser.uid);
              try { localStorage.setItem(notifKey, 'true'); } catch {}

              // Atomic batch commit: guarantees both docs exist together without extra reads
              const batch = writeBatch(db);
              batch.set(userRef, newUserData);
              batch.set(notifRef, notifData);
              await batch.commit();

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
