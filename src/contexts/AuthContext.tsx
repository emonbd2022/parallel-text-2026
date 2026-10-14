import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, orderBy, limit, writeBatch, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { recordFirestoreRead, recordFirestoreWrite, isFirestoreQuotaExhausted, markFirestoreQuotaExhausted, handleFirestoreError } from '../utils/firestoreAudit';
import { getOrCreateDeviceId, detectDeviceMetadata, DeviceMetadata, MAX_DEVICES_PER_ACCOUNT } from '../utils/deviceManager';

export const ADMIN_EMAILS = [
  'elarainfinity@gmail.com',
  'titaniumfact97@gmail.com',
  'reactoremon2022@gmail.com'
];

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
  plan?: 'free' | 'starter' | 'pro' | 'elite' | 'unlimited' | 'expired';
  planStartDate?: string;
  planEndDate?: string;
  deviceIds?: string[];
  devices?: DeviceMetadata[];
  centralApiAccess?: boolean;
  deviceLimitReached?: boolean;
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
  paymentId?: string;
  trxId?: string;
  amount?: number;
  method?: 'bkash' | 'nagad';
  userUid?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
  maintenanceMode: boolean;
  setMaintenanceMode: React.Dispatch<React.SetStateAction<boolean>>;
  centralModeEnabled: boolean;
  setCentralModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  notifications: AppNotification[];
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  deleteNotification: (id: string, globalDelete?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  resetUserDevices: (targetUid?: string) => Promise<void>;
  refreshUserData: (force?: boolean) => Promise<UserData | null>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userData: null, 
  loading: true, 
  setUserData: () => {},
  maintenanceMode: false,
  setMaintenanceMode: () => {},
  centralModeEnabled: true,
  setCentralModeEnabled: () => {},
  notifications: [],
  setNotifications: () => {},
  deleteNotification: async () => {},
  logout: async () => {},
  resetUserDevices: async () => {},
  refreshUserData: async () => null
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
  const [centralModeEnabled, setCentralModeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('centralModeEnabled') !== 'false';
    } catch {
      return true;
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
  const hasFetchedAdminNotifsRef = useRef<boolean>(false);

  useEffect(() => {
    // 1. Initial query check: use cached state and fetch at most once per session
    const sessionCapacityFetched = sessionStorage.getItem('central_capacity_fetched');
    if (!sessionCapacityFetched) {
      fetch('/api/central-keys-capacity')
        .then(r => r.json())
        .then(data => {
          if (typeof data.centralModeEnabled === 'boolean') {
            setCentralModeEnabled(data.centralModeEnabled);
            try { 
              localStorage.setItem('centralModeEnabled', String(data.centralModeEnabled));
              sessionStorage.setItem('central_capacity_fetched', 'true');
            } catch {}
          }
        })
        .catch(() => {});
    }

    // 2. Real-time Firestore snapshot listener for instant admin toggle reaction
    if (!db) return;
    try {
      const unsub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (typeof data?.maintenanceMode === 'boolean') {
            setMaintenanceMode(data.maintenanceMode);
            try { localStorage.setItem('maintenanceMode', String(data.maintenanceMode)); } catch {}
          }
          if (typeof data?.centralModeEnabled === 'boolean') {
            setCentralModeEnabled(data.centralModeEnabled);
            try { localStorage.setItem('centralModeEnabled', String(data.centralModeEnabled)); } catch {}
          }
        }
      }, (err) => {
        console.warn("Snapshot settings notice:", err);
      });
      return () => unsub();
    } catch (e) {
      console.warn("Could not attach settings snapshot listener:", e);
    }
  }, []);

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
    if (db && userData?.role === 'admin' && !isFirestoreQuotaExhausted()) {
      try {
        await deleteDoc(doc(db, 'notifications', id));
        recordFirestoreWrite('notifications', 1, 'AuthContext:deleteNotification');
        console.log(`[Notification] Admin explicitly deleted notification from server: notifications/${id}`);
      } catch (err: any) {
        handleFirestoreError(err, 'AuthContext:deleteNotification');
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
    // Clean up device limit error flag on logout
    localStorage.removeItem('deviceLimitError');
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

  const resetUserDevices = async (targetUid?: string) => {
    const uidToReset = targetUid || user?.uid || userData?.uid;
    if (!uidToReset || !db) return;

    const isSelf = !targetUid || targetUid === user?.uid;
    const currentDevId = getOrCreateDeviceId();
    const currentMeta = detectDeviceMetadata(currentDevId);
    const newDeviceIds = isSelf ? [currentDevId] : [];
    const newDevices = isSelf ? [{ ...currentMeta, registeredAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() }] : [];

    localStorage.removeItem('deviceLimitError');
    try {
      localStorage.removeItem(`userCacheTime_${uidToReset}`);
    } catch {}

    if (!isFirestoreQuotaExhausted()) {
      try {
        const userRef = doc(db, 'users', uidToReset);
        await updateDoc(userRef, {
          deviceIds: newDeviceIds,
          devices: newDevices,
          lastActiveAt: new Date().toISOString()
        });
        recordFirestoreWrite('users', 1, 'AuthContext:resetUserDevices');
      } catch (e: any) {
        handleFirestoreError(e, 'AuthContext:resetUserDevices');
      }
    }

    if (isSelf && userData) {
      const updated: UserData = {
        ...userData,
        deviceIds: newDeviceIds,
        devices: newDevices,
        deviceLimitReached: false
      };
      setUserData(updated);
      saveUserDataToCache(updated);
    }
  };

  const checkAndSyncUserDoc = async (currentUser: User, forceRefresh = false): Promise<UserData | null> => {
    if (!db) return null;
    try {
      const deviceId = getOrCreateDeviceId();
      const cached = getUserDataFromCache(currentUser.uid);
      const isFirstAdminUser = ADMIN_EMAILS.includes(currentUser.email || '');
      
      // If cached user has an expired plan, reset credits to 0 and unlimited to false
      if (cached && !isFirstAdminUser) {
        const isExp = (cached.planEndDate && new Date(cached.planEndDate).getTime() < Date.now()) || cached.plan === 'expired';
        if (isExp) {
          cached.unlimited = false;
          cached.credits = 0;
          cached.plan = 'expired';
          saveUserDataToCache(cached);
        }
      }

      const lastFetch = Number(localStorage.getItem(`userCacheTime_${currentUser.uid}`) || 0);
      const isFresh = Date.now() - lastFetch < 30 * 60 * 1000; // 30 minutes TTL
      const isCurrentDeviceRegistered = Array.isArray(cached?.deviceIds) && cached.deviceIds.includes(deviceId);

      // Fast-path: ONLY bypass Firestore if cached state has NO device limit error, user is not blocked, and current device is already authorized
      if (cached && isFresh && !forceRefresh && !cached.deviceLimitReached && !cached.blocked && isCurrentDeviceRegistered) {
        setUserData(cached);
        setLoading(false);
        return cached;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userRef);
      recordFirestoreRead('users', 1, 'AuthContext:getUserDoc');
      localStorage.setItem(`userCacheTime_${currentUser.uid}`, Date.now().toString());
      
      if (docSnap.exists()) {
        const d = docSnap.data();

        // Device ID Policy Enforcement: 1 Account = Max 2 Devices
        const currentMeta = detectDeviceMetadata(deviceId);
        let dbDeviceIds: string[] = Array.isArray(d.deviceIds) ? [...d.deviceIds].filter(Boolean) : [];
        let dbDevices: DeviceMetadata[] = Array.isArray(d.devices) ? [...d.devices].filter(Boolean) : [];
        let shouldUpdateDoc = false;
        const isFirstAdmin = ADMIN_EMAILS.includes(currentUser.email || '');
        let role = (isFirstAdmin || d.role === 'admin') ? 'admin' : (d.role || 'user');
        let isBlocked = isFirstAdmin ? false : !!d.blocked;
        let deviceLimitReached = false;

        // Auto-unblock hardcoded admins
        if (isFirstAdmin && d.blocked) {
          isBlocked = false;
          shouldUpdateDoc = true;
        }

        if (isFirstAdmin && d.role !== 'admin') {
          role = 'admin';
          shouldUpdateDoc = true;
        }

        // Device Authorization Logic (Enforced on initial check & recurring visits)
        if (isFirstAdmin || role === 'admin') {
          // Admin device limit bypass: automatically authorize current device without limit
          if (!dbDeviceIds.includes(deviceId)) {
            dbDeviceIds.push(deviceId);
            dbDevices.push({
              ...currentMeta,
              registeredAt: new Date().toISOString(),
              lastActiveAt: new Date().toISOString()
            });
            shouldUpdateDoc = true;
          }
          deviceLimitReached = false;
        } else if (dbDeviceIds.includes(deviceId)) {
          // Current device is already registered in slot 1 or 2
          deviceLimitReached = false;
        } else if (dbDeviceIds.length < MAX_DEVICES_PER_ACCOUNT) {
          // New authorized device occupying an open slot (Slot 1 or Slot 2) (e.g. after admin reset)
          dbDeviceIds.push(deviceId);
          dbDevices.push({
            ...currentMeta,
            registeredAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString()
          });
          shouldUpdateDoc = true;
          deviceLimitReached = false;
        } else {
          // Standard user 3rd device attempt: enforce limit
          deviceLimitReached = true;
        }

        if (deviceLimitReached) {
          localStorage.setItem('deviceLimitError', 'true');
        } else {
          localStorage.removeItem('deviceLimitError');
        }

        if (shouldUpdateDoc && !isFirestoreQuotaExhausted()) {
          try {
            const updates: any = { 
              deviceIds: dbDeviceIds,
              devices: dbDevices,
              lastActiveAt: new Date().toISOString()
            };
            if (isFirstAdmin) {
              updates.role = 'admin';
              updates.blocked = false;
              updates.unlimited = true;
              updates.centralApiAccess = true;
              updates.credits = 999999;
            }
            await updateDoc(userRef, updates);
            recordFirestoreWrite('users', 1, 'AuthContext:updateUserDoc');
          } catch (e: any) {
            handleFirestoreError(e, 'AuthContext:updateUserDoc');
          }
        }

        const isFirstUser = isFirstAdmin;
        let isExpired = false;
        if (!isFirstUser && d.planEndDate) {
          try {
            isExpired = new Date(d.planEndDate).getTime() < Date.now();
          } catch {}
        } else if (!isFirstUser && d.plan === 'expired') {
          isExpired = true;
        }

        const effectiveUnlimited = isFirstUser || (isExpired ? false : !!d.unlimited);
        const effectivePlan: UserData['plan'] = isFirstUser ? 'unlimited' : (isExpired ? 'expired' : (d.plan || 'free'));
        const effectiveCredits = isFirstUser ? 999999 : (isExpired ? 0 : (typeof d.credits === 'number' ? d.credits : 10));

        // Auto-persist expired status to Firestore if user passed 1 month
        if (!isFirstUser && isExpired && (d.unlimited || (typeof d.credits === 'number' && d.credits > 0) || d.plan !== 'expired')) {
          try {
            updateDoc(userRef, {
              unlimited: false,
              credits: 0,
              plan: 'expired',
              lastActiveAt: new Date().toISOString()
            }).catch(() => {});
          } catch {}
        }

        const serverData: UserData = {
          uid: currentUser.uid,
          email: d.email || currentUser.email || '',
          name: d.name || currentUser.displayName || '',
          photoURL: d.photoURL || currentUser.photoURL || '',
          nickname: d.nickname || currentUser.displayName?.split(' ')[0] || 'User',
          credits: effectiveCredits,
          unlimited: effectiveUnlimited,
          totalProcessedImages: typeof d.totalProcessedImages === 'number' ? d.totalProcessedImages : 0,
          joinDate: d.joinDate || new Date().toISOString(),
          blocked: isBlocked,
          role: (d.role === 'admin' || isFirstUser) ? 'admin' : 'user',
          plan: effectivePlan,
          planStartDate: d.planStartDate,
          planEndDate: d.planEndDate,
          deviceIds: dbDeviceIds,
          devices: dbDevices,
          centralApiAccess: (d.role === 'admin' || isFirstUser) ? true : Boolean(d.centralApiAccess),
          deviceLimitReached: (isFirstAdmin || role === 'admin') ? false : deviceLimitReached,
        };

        saveUserDataToCache(serverData);
        setUserData(serverData);
        return serverData;
      } else {
        // Genuinely NEW user: create initial user document and admin notification atomically in ONE writeBatch
        const isFirstUser = ADMIN_EMAILS.includes(currentUser.email || '');
        const userName = currentUser.displayName || 'User';
        const userEmail = currentUser.email || '';
        const nowISO = new Date().toISOString();

        const currentMeta = detectDeviceMetadata(deviceId);

        const newUserData: UserData = {
          uid: currentUser.uid,
          email: userEmail,
          name: userName,
          photoURL: currentUser.photoURL || '',
          nickname: userName.split(' ')[0] || 'User',
          credits: isFirstUser ? 999999 : 10, // New user gets 10 trial credits
          unlimited: isFirstUser,
          totalProcessedImages: 0,
          joinDate: nowISO,
          blocked: false,
          role: isFirstUser ? 'admin' : 'user',
          plan: isFirstUser ? 'unlimited' : 'free',
          deviceIds: [deviceId],
          devices: [{ ...currentMeta, registeredAt: nowISO, lastActiveAt: nowISO }],
          centralApiAccess: isFirstUser ? true : false,
          deviceLimitReached: false,
        };

        const notifId = `signup_${currentUser.uid}`;
        const notifRef = doc(db, 'notifications', notifId);
        const notifData: AppNotification = {
          id: notifId,
          targetUid: 'admin',
          type: 'signup',
          message: `New User Signup\nName: ${userName}\nEmail: ${userEmail}\nTrial Credits: 10`,
          userName,
          userEmail,
          createdAt: nowISO,
          read: false,
        };

        // Atomic batch commit: guarantees both docs exist together without extra reads (guarded against quota limit)
        if (!isFirestoreQuotaExhausted()) {
          try {
            const batch = writeBatch(db);
            batch.set(userRef, newUserData);
            batch.set(notifRef, notifData);
            await batch.commit();
            recordFirestoreWrite('users', 1, 'AuthContext:createUserDoc');
            recordFirestoreWrite('notifications', 1, 'AuthContext:createSignupNotification');
            console.log(`[Auth] Atomically registered new user (${currentUser.uid}) and created admin notification (${notifId})`);
          } catch (batchErr) {
            handleFirestoreError(batchErr, 'AuthContext:createUserDoc');
          }
        }

        setUserData(newUserData);
        saveUserDataToCache(newUserData);
        return newUserData;
      }
    } catch (error: any) {
      console.warn("[Auth] Firestore user sync notice:", error?.message || error);
      if (currentUser) {
        const cached = getUserDataFromCache(currentUser.uid);
        if (cached) {
          setUserData(cached);
          return cached;
        } else {
          const isFirstUser = ADMIN_EMAILS.includes(currentUser.email || '');
          const deviceId = getOrCreateDeviceId();
          const currentMeta = detectDeviceMetadata(deviceId);
          const nowISO = new Date().toISOString();
          const fallbackData: UserData = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            name: currentUser.displayName || 'User',
            photoURL: currentUser.photoURL || '',
            nickname: (currentUser.displayName || currentUser.email || 'User').split(' ')[0],
            credits: isFirstUser ? 999999 : 10,
            unlimited: isFirstUser,
            totalProcessedImages: 0,
            joinDate: nowISO,
            blocked: false,
            role: isFirstUser ? 'admin' : 'user',
            plan: isFirstUser ? 'unlimited' : 'free',
            deviceIds: [deviceId],
            devices: [{ ...currentMeta, registeredAt: nowISO, lastActiveAt: nowISO }],
            centralApiAccess: isFirstUser,
            deviceLimitReached: false,
          };
          setUserData(fallbackData);
          saveUserDataToCache(fallbackData);
          return fallbackData;
        }
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const refreshUserData = async (force = true): Promise<UserData | null> => {
    if (!auth?.currentUser) return null;
    return await checkAndSyncUserDoc(auth.currentUser, force);
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    let userDocUnsubscribe: (() => void) | null = null;
    let lastFocusSyncTime = Date.now();

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Clean up previous user document listener
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
        userDocUnsubscribe = null;
      }

      if (currentUser) {
        // Step 1: Hydrate from cache only if the cached profile explicitly matches this specific user UID
        const localCached = getUserDataFromCache(currentUser.uid);
        if (localCached && localCached.uid === currentUser.uid && !localCached.deviceLimitReached) {
          setUserData(localCached);
        }

        // Step 2: Sync and validate user doc & device registration
        await checkAndSyncUserDoc(currentUser, true);

        // Step 3: Attach real-time listener to user doc so admin resets immediately take effect
        if (db && !isFirestoreQuotaExhausted()) {
          try {
            userDocUnsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
              if (snap.exists()) {
                const d = snap.data();
                const deviceId = getOrCreateDeviceId();
                const currentMeta = detectDeviceMetadata(deviceId);
                const dbDeviceIds: string[] = Array.isArray(d.deviceIds) ? [...d.deviceIds].filter(Boolean) : [];
                const dbDevices: DeviceMetadata[] = Array.isArray(d.devices) ? [...d.devices].filter(Boolean) : [];
                const isFirstAdmin = ADMIN_EMAILS.includes(currentUser.email || '');
                const role = (isFirstAdmin || d.role === 'admin') ? 'admin' : (d.role || 'user');
                const isBlocked = isFirstAdmin ? false : !!d.blocked;
                let deviceLimitReached = false;

                if (isFirstAdmin || role === 'admin') {
                  deviceLimitReached = false;
                  if (!dbDeviceIds.includes(deviceId)) {
                    // Automatically register admin device in background
                    updateDoc(snap.ref, {
                      deviceIds: [...dbDeviceIds, deviceId],
                      devices: [...dbDevices, { ...currentMeta, registeredAt: new Date().toISOString(), lastActiveAt: new Date().toISOString() }],
                      lastActiveAt: new Date().toISOString()
                    }).catch(() => {});
                  }
                } else if (dbDeviceIds.includes(deviceId)) {
                  deviceLimitReached = false;
                } else if (dbDeviceIds.length < MAX_DEVICES_PER_ACCOUNT) {
                  // Admin just reset devices or slot is open: automatically register current device into open slot!
                  deviceLimitReached = false;
                  dbDeviceIds.push(deviceId);
                  dbDevices.push({
                    ...currentMeta,
                    registeredAt: new Date().toISOString(),
                    lastActiveAt: new Date().toISOString()
                  });
                  updateDoc(snap.ref, {
                    deviceIds: dbDeviceIds,
                    devices: dbDevices,
                    lastActiveAt: new Date().toISOString()
                  }).catch(() => {});
                } else {
                  deviceLimitReached = true;
                }

                if (deviceLimitReached) {
                  localStorage.setItem('deviceLimitError', 'true');
                } else {
                  localStorage.removeItem('deviceLimitError');
                }

                let isSnapshotExpired = false;
                if (!isFirstAdmin && d.planEndDate) {
                  try {
                    isSnapshotExpired = new Date(d.planEndDate).getTime() < Date.now();
                  } catch {}
                } else if (!isFirstAdmin && d.plan === 'expired') {
                  isSnapshotExpired = true;
                }
                const snapshotUnlimited = isFirstAdmin || (isSnapshotExpired ? false : !!d.unlimited);
                const snapshotPlan: UserData['plan'] = isFirstAdmin ? 'unlimited' : (isSnapshotExpired ? 'expired' : (d.plan || 'free'));
                const snapshotCredits = isFirstAdmin ? 999999 : (isSnapshotExpired ? 0 : (typeof d.credits === 'number' ? d.credits : 10));

                if (!isFirstAdmin && isSnapshotExpired && (d.unlimited || (typeof d.credits === 'number' && d.credits > 0) || d.plan !== 'expired')) {
                  try {
                    updateDoc(snap.ref, {
                      unlimited: false,
                      credits: 0,
                      plan: 'expired',
                      lastActiveAt: new Date().toISOString()
                    }).catch(() => {});
                  } catch {}
                }

                const updatedData: UserData = {
                  uid: currentUser.uid,
                  email: d.email || currentUser.email || '',
                  name: d.name || currentUser.displayName || '',
                  photoURL: d.photoURL || currentUser.photoURL || '',
                  nickname: d.nickname || currentUser.displayName?.split(' ')[0] || 'User',
                  credits: snapshotCredits,
                  unlimited: snapshotUnlimited,
                  totalProcessedImages: typeof d.totalProcessedImages === 'number' ? d.totalProcessedImages : 0,
                  joinDate: d.joinDate || new Date().toISOString(),
                  blocked: isBlocked,
                  role: (d.role === 'admin' || isFirstAdmin) ? 'admin' : 'user',
                  plan: snapshotPlan,
                  planStartDate: d.planStartDate,
                  planEndDate: d.planEndDate,
                  deviceIds: dbDeviceIds,
                  devices: dbDevices,
                  centralApiAccess: (d.role === 'admin' || isFirstAdmin) ? true : Boolean(d.centralApiAccess),
                  deviceLimitReached: (isFirstAdmin || role === 'admin') ? false : deviceLimitReached,
                };

                setUserData(updatedData);
                saveUserDataToCache(updatedData);
              }
            }, (err) => {
              console.warn('[Auth] onSnapshot error:', err?.message || err);
            });
          } catch (e) {
            console.warn('[Auth] Failed to attach user doc listener:', e);
          }
        }
      } else {
        // User logged out: Reset current user state but keep persisted cache in localStorage
        setUser(null);
        setUserData(null);
        setNotifications([]);
        checkedUserUidRef.current = null;
        setLoading(false);
      }
    });

    // Throttled sync on window focus / tab re-activation
    const handleFocusSync = () => {
      const now = Date.now();
      if (auth.currentUser && (now - lastFocusSyncTime > 15 * 60 * 1000)) {
        lastFocusSyncTime = now;
        checkAndSyncUserDoc(auth.currentUser, true);
      }
    };

    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleFocusSync();
      }
    });

    return () => {
      unsubscribeAuth();
      if (userDocUnsubscribe) {
        userDocUnsubscribe();
      }
      window.removeEventListener('focus', handleFocusSync);
    };
  }, []);

  // Real-time automatic plan expiration watcher: resets to zero after 1 month
  useEffect(() => {
    if (!userData || userData.role === 'admin' || !userData.unlimited) return;

    const checkExpiration = () => {
      if (userData.planEndDate) {
        const endTime = new Date(userData.planEndDate).getTime();
        if (endTime <= Date.now()) {
          const expiredData: UserData = {
            ...userData,
            unlimited: false,
            credits: 0,
            plan: 'expired'
          };
          setUserData(expiredData);
          saveUserDataToCache(expiredData);

          if (db && !isFirestoreQuotaExhausted()) {
            updateDoc(doc(db, 'users', userData.uid), {
              unlimited: false,
              credits: 0,
              plan: 'expired',
              lastActiveAt: new Date().toISOString()
            }).catch(() => {});
          }
        }
      }
    };

    checkExpiration();
    const timer = setInterval(checkExpiration, 10000); // Check every 10 seconds
    return () => clearInterval(timer);
  }, [userData?.uid, userData?.unlimited, userData?.planEndDate]);

  return (
    <AuthContext.Provider value={{ user, userData, loading, setUserData, maintenanceMode, setMaintenanceMode, centralModeEnabled, setCentralModeEnabled, notifications, setNotifications, deleteNotification, logout, resetUserDevices, refreshUserData }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
