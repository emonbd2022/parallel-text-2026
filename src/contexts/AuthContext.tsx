import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { recordFirestoreRead, recordFirestoreWrite } from '../utils/firestoreAudit';

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
  deviceIds?: string[];
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
  deleteNotification: (id: string, globalDelete?: boolean) => Promise<void>;
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
  deleteNotification: async () => {},
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
      const activeUid = cachedData?.uid;
      const dismissed = activeUid ? [
        ...JSON.parse(localStorage.getItem(`dismissedNotifs_${activeUid}`) || '[]'),
        ...JSON.parse(localStorage.getItem(`dismissedGlobalNotifs_${activeUid}`) || '[]')
      ] : [];
      const stored = activeUid ? localStorage.getItem(`localNotifications_${activeUid}`) : localStorage.getItem('localNotifications');
      if (!stored) return [];
      const parsed: AppNotification[] = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter(n => !dismissed.includes(n.id)) : [];
    } catch {
      return [];
    }
  });

  const notificationsRef = useRef<AppNotification[]>(notifications);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Guard to ensure strictly 1 real-time Firestore fetch occurs after each page reload/initial auth per UID
  const checkedUserUidRef = useRef<string | null>(null);
  const fetchedSettingsRef = useRef<boolean>(false);
  const hasFetchedAdminNotifsRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user || fetchedSettingsRef.current || !db) return;
    fetchedSettingsRef.current = true;

    getDoc(doc(db, 'settings', 'general'))
      .then((docSnap) => {
        recordFirestoreRead('settings', 1, 'AuthContext:getSettings');
        if (docSnap.exists()) {
          const isMaint = docSnap.data()?.maintenanceMode === true;
          setMaintenanceMode(isMaint);
          try { localStorage.setItem('maintenanceMode', String(isMaint)); } catch {}
        }
      })
      .catch((err) => {
        console.warn("Could not check maintenance mode settings:", err);
      });
  }, [user]);

  // Whenever userData changes, keep cache continuously updated
  useEffect(() => {
    if (userData) {
      saveUserDataToCache(userData);
    }
  }, [userData]);

  // One-shot fetch notifications strictly once per session
  useEffect(() => {
    if (!userData || !db || hasFetchedAdminNotifsRef.current) return;
    
    // Check session cache to avoid repeating query on route changes / component remounts
    const sessionKey = `notifsFetched_${userData.uid}`;
    const sessionFetched = sessionStorage.getItem(sessionKey) === 'true';
    if (sessionFetched) {
      hasFetchedAdminNotifsRef.current = true;
      try {
        const dismissedNotifs = [
          ...JSON.parse(localStorage.getItem(`dismissedNotifs_${userData.uid}`) || '[]'),
          ...JSON.parse(localStorage.getItem(`dismissedGlobalNotifs_${userData.uid}`) || '[]')
        ];
        const cached = localStorage.getItem(`cachedNotifs_${userData.uid}`) || localStorage.getItem('cachedNotifs');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(n => !dismissedNotifs.includes(n.id));
            setNotifications(filtered);
            return;
          }
        }
      } catch {}
    }

    hasFetchedAdminNotifsRef.current = true;
    try { sessionStorage.setItem(sessionKey, 'true'); } catch {}

    const queries = [];
    
    if (userData.role === 'admin') {
      queries.push(query(
        collection(db, 'notifications'),
        where('targetUid', '==', 'admin'),
        orderBy('createdAt', 'desc'),
        limit(5)
      ));
    }
    
    queries.push(query(
        collection(db, 'notifications'),
        where('targetUid', '==', 'all'),
        orderBy('createdAt', 'desc'),
        limit(5)
    ));

    Promise.all(queries.map(q => getDocs(q).then(snap => {
        recordFirestoreRead('notifications', snap.docs.length || 1, 'AuthContext:getNotifications');
        return snap;
    }).catch(e => {
        console.error("Failed to fetch notification query:", e);
        return { docs: [] } as any;
    })))
      .then((results) => {
        const dismissedNotifs: string[] = [
          ...JSON.parse(localStorage.getItem(`dismissedNotifs_${userData.uid}`) || '[]'),
          ...JSON.parse(localStorage.getItem(`dismissedGlobalNotifs_${userData.uid}`) || '[]')
        ];
        
        let allFetched: AppNotification[] = [];
        results.forEach(snap => {
            snap.docs.forEach(d => {
                const data = d.data();
                const notifId = data.id || d.id;
                // Exclude if it's a notification that user/admin already dismissed locally
                if (dismissedNotifs.includes(notifId)) return;
                
                allFetched.push({
                    id: notifId,
                    targetUid: data.targetUid || 'admin',
                    type: data.type || 'signup',
                    message: data.message || `New User Signup\nName: ${data.userName || 'User'}\nEmail: ${data.userEmail || ''}`,
                    userName: data.userName,
                    userEmail: data.userEmail,
                    createdAt: data.createdAt || new Date().toISOString(),
                    read: data.read === true
                });
            });
        });

        setNotifications(prev => {
          const dismissedSet = new Set(dismissedNotifs);
          const filteredPrev = prev.filter(p => !dismissedSet.has(p.id));
          const existingIds = new Set(filteredPrev.map(p => p.id));
          const combined = [...filteredPrev];
          allFetched.forEach(fn => {
            if (!existingIds.has(fn.id) && !dismissedSet.has(fn.id)) {
              combined.push(fn);
            }
          });
          const sorted = combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          try { 
            localStorage.setItem(`cachedNotifs_${userData.uid}`, JSON.stringify(sorted));
            localStorage.setItem(`localNotifications_${userData.uid}`, JSON.stringify(sorted));
          } catch {}
          return sorted;
        });
      })
      .catch((err) => {
        console.error("CRITICAL: Could not load notifications from Firestore:", err);
      });
  }, [userData]);

  useEffect(() => {
    try {
      if (userData?.uid) {
        localStorage.setItem(`localNotifications_${userData.uid}`, JSON.stringify(notifications));
      }
    } catch {}
  }, [notifications, userData]);

  const deletingNotifIdsRef = useRef<Set<string>>(new Set());

  const deleteNotification = async (id: string, serverDelete: boolean = false) => {
    if (!id) return;
    if (!serverDelete && deletingNotifIdsRef.current.has(id)) return;
    if (!serverDelete) deletingNotifIdsRef.current.add(id);

    // 1. Immediately remove from React state & local caches for current user
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      try {
        if (userData?.uid) {
          localStorage.setItem(`localNotifications_${userData.uid}`, JSON.stringify(updated));
          localStorage.setItem(`cachedNotifs_${userData.uid}`, JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });

    // 2. Direct clean up of cachedNotifs in localStorage
    try {
      if (userData?.uid) {
        const cached = localStorage.getItem(`cachedNotifs_${userData.uid}`);
        if (cached) {
          const parsed: AppNotification[] = JSON.parse(cached);
          const filtered = parsed.filter(n => n.id !== id);
          localStorage.setItem(`cachedNotifs_${userData.uid}`, JSON.stringify(filtered));
        }
      }
    } catch {}

    // 3. Mark as dismissed locally for this user (both users and admins)
    if (userData?.uid) {
      try {
        const key1 = `dismissedNotifs_${userData.uid}`;
        const dismissed1: string[] = JSON.parse(localStorage.getItem(key1) || '[]');
        if (!dismissed1.includes(id)) {
          dismissed1.push(id);
          localStorage.setItem(key1, JSON.stringify(dismissed1));
        }

        const key2 = `dismissedGlobalNotifs_${userData.uid}`;
        const dismissed2: string[] = JSON.parse(localStorage.getItem(key2) || '[]');
        if (!dismissed2.includes(id)) {
          dismissed2.push(id);
          localStorage.setItem(key2, JSON.stringify(dismissed2));
        }
      } catch {}
    }

    // 4. If this is NOT an explicit server deletion, STOP HERE!
    // Viewing a notification (by any user or admin) MUST NEVER delete it from the server!
    if (!serverDelete) {
      return;
    }

    // 5. Only when serverDelete is explicitly TRUE and current user is Admin:
    // Execute single deleteDoc() operation on Firestore to remove from server
    if (db && userData?.role === 'admin') {
      try {
        await deleteDoc(doc(db, 'notifications', id));
        recordFirestoreWrite('notifications', 1, 'AuthContext:deleteNotification');
        console.log(`[Notification] Admin explicitly deleted notification from server: notifications/${id}`);
      } catch (err: any) {
        console.error(`[Notification] Failed to delete notification notifications/${id} from Firestore:`, err);
        deletingNotifIdsRef.current.delete(id);
      }
    }
  };

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
    checkedUserUidRef.current = null;
    hasFetchedAdminNotifsRef.current = false;
    try { 
      sessionStorage.removeItem('adminNotifsFetched'); 
      sessionStorage.removeItem('notifsFetched');
      if (userData?.uid) {
        sessionStorage.removeItem(`notifsFetched_${userData.uid}`);
      }
    } catch {}
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Step 1: Hydrate from cache only if the cached profile explicitly matches this specific user UID
        const localCached = getUserDataFromCache(currentUser.uid);
        if (localCached && localCached.uid === currentUser.uid) {
          setUserData(localCached);
        }

        // Step 2: Exactly ONE Firestore check per user session/reload
        if (checkedUserUidRef.current !== currentUser.uid && db) {
          checkedUserUidRef.current = currentUser.uid;

          try {
            const userRef = doc(db, 'users', currentUser.uid);
            const docSnap = await getDoc(userRef);
            recordFirestoreRead('users', 1, 'AuthContext:getUserDoc');
            
            if (docSnap.exists()) {
              const d = docSnap.data();

              // Device ID Policy Enforcement
              let deviceId = localStorage.getItem('deviceId');
              if (!deviceId) {
                deviceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                localStorage.setItem('deviceId', deviceId);
              }

              let dbDeviceIds = Array.isArray(d.deviceIds) ? [...d.deviceIds] : [];
              let shouldUpdateDoc = false;
              let isBlocked = !!d.blocked;

              if (d.role !== 'admin' && !dbDeviceIds.includes(deviceId)) {
                if (dbDeviceIds.length < 2) {
                  dbDeviceIds.push(deviceId);
                  shouldUpdateDoc = true;
                } else {
                  isBlocked = true;
                  shouldUpdateDoc = true;
                }
              }

              if (shouldUpdateDoc) {
                try {
                  const updates: any = { deviceIds: dbDeviceIds };
                  if (isBlocked && !d.blocked) {
                    updates.blocked = true;
                  }
                  await updateDoc(userRef, updates);
                  recordFirestoreWrite('users', 1, 'AuthContext:updateDeviceIds');
                } catch (e) {
                  console.error('Failed to update device limits', e);
                }
              }

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
                blocked: isBlocked,
                role: d.role === 'admin' ? 'admin' : (isFirstUser ? 'admin' : 'user'),
                plan: d.plan || 'free',
                planStartDate: d.planStartDate,
                planEndDate: d.planEndDate,
                deviceIds: dbDeviceIds,
              };

              // Update state & cache if data is changed or freshly fetched
              setUserData(prev => {
                const isDifferent = !prev || 
                  prev.uid !== serverData.uid ||
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
              // Genuinely NEW user: create initial user document and admin notification atomically in ONE writeBatch
              const isFirstUser = currentUser.email === 'titaniumfact97@gmail.com' || currentUser.email === 'reactoremon2022@gmail.com';
              const userName = currentUser.displayName || 'User';
              const userEmail = currentUser.email || '';
              const nowISO = new Date().toISOString();

              let deviceId = localStorage.getItem('deviceId');
              if (!deviceId) {
                deviceId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                localStorage.setItem('deviceId', deviceId);
              }

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
                deviceIds: [deviceId],
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

              // Atomic batch commit: guarantees both docs exist together without extra reads
              const batch = writeBatch(db);
              batch.set(userRef, newUserData);
              batch.set(notifRef, notifData);
              await batch.commit();
              recordFirestoreWrite('users', 1, 'AuthContext:createUserDoc');
              recordFirestoreWrite('notifications', 1, 'AuthContext:createSignupNotification');
              console.log(`[Auth] Atomically registered new user (${currentUser.uid}) and created admin notification (${notifId})`);

              setUserData(newUserData);
              saveUserDataToCache(newUserData);
            }
          } catch (error: any) {
            console.error("CRITICAL: Failed to initialize new user and signup notification in Firestore:", error);
            if (error?.code) {
              console.error(`Firebase Error Code: ${error.code}, Message: ${error.message}`);
            }
          }
        }
      } else {
        // User logged out: Reset current user state but keep persisted cache in localStorage
        setUser(null);
        setUserData(null);
        setNotifications([]);
        checkedUserUidRef.current = null;
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, setUserData, maintenanceMode, setMaintenanceMode, notifications, setNotifications, deleteNotification, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
