import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, serverTimestamp, addDoc, collection, query, where, orderBy, limit } from 'firebase/firestore';
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
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

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
          
          // Parallelize initial reads to reduce waterfall latency and ensure single-pass loading
          const [docSnap, maintenanceSnap] = await Promise.all([
              getDoc(userRef),
              getDoc(doc(db, 'settings', 'general'))
          ]);

          if (maintenanceSnap.exists()) {
              setMaintenanceMode(maintenanceSnap.data().maintenanceMode || false);
          }
          
          if (docSnap.exists()) {
              const data = docSnap.data() as UserData;
              setUserData(data);

              // Background fetch notifications
              const targets = [currentUser.uid, 'all'];
              if (data.role === 'admin') targets.push('admin');
              
              const q = query(collection(db, 'notifications'), where('targetUid', 'in', targets), orderBy('createdAt', 'desc'), limit(20));
              getDocs(q).then(notifSnap => {
                  const readIds = JSON.parse(localStorage.getItem('readNotifs') || '[]');
                  const notifs = notifSnap.docs.map(d => {
                      const dData = d.data();
                      return { id: d.id, ...dData, read: dData.read || readIds.includes(d.id) };
                  });
                  setNotifications(notifs);
              }).catch(e => console.warn("Background notification load failed", e));

          } else {
              // Initialize user
              const isFirstUser = currentUser.email === 'titaniumfact97@gmail.com';
              const newUserData: UserData = {
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
                appData: {
                    apiUsage: {},
                    keys: [],
                    config: {}
                }
              };
              
              await setDoc(userRef, newUserData);
              setUserData(newUserData);
              
              if (!isFirstUser) {
                  try {
                      await addDoc(collection(db, 'notifications'), {
                          targetUid: 'admin',
                          type: 'signup',
                          message: `New user signed up: ${currentUser.email}`,
                          read: false,
                          createdAt: serverTimestamp()
                      });
                  } catch (e) {}
              }
          }
        } catch (error) {
          console.error("Error loading user data:", error);
        }
      } else {
        setUserData(null);
        setMaintenanceMode(false);
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
