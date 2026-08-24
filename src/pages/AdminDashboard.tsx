import { motion } from 'motion/react';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { where, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, setDoc, collection, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, UserData, AppNotification } from '../contexts/AuthContext';
import { Shield, Search, RefreshCw, Trash2, CheckCircle2, AlertTriangle, Loader2, Send, Bell, X, Info, CheckCircle, Users, Globe, UserPlus, Eye, MessageSquare, ArrowUpDown, Image as ImageIcon, Key, Sparkles, Plus, Copy, Check, Zap } from 'lucide-react';
import { 
  fetchAdminCentralKeys, 
  addCentralKeyToFirestore, 
  toggleCentralKeyStatus, 
  deleteCentralKeyFromFirestore,
  CentralKeyRecord 
} from '../services/centralKeyService';
import { recordFirestoreRead, recordFirestoreWrite } from '../utils/firestoreAudit';

type SortOption = 'recent_active' | 'recently_signed_up' | 'top_users' | 'least_active';

export const AdminDashboard: React.FC = () => {
  const { userData: currentAdmin, maintenanceMode, setMaintenanceMode, notifications, setNotifications, deleteNotification } = useAuth();
  
  // Dashboard Tabs: 'users' | 'notifications'
  const [activeTab, setActiveTab] = useState<'users' | 'notifications' | 'keys'>('users');
  const [sortBy, setSortBy] = useState<SortOption>('recent_active');
  const [viewMode, setViewMode] = useState<'paginated' | 'all'>('paginated');

  // Cache pages in sessionStorage so navigating away and returning costs 0 Firestore reads
  const getInitialUsersCache = (): Record<number, UserData[]> => {
    try {
      const s = sessionStorage.getItem('adminCachedUsersByPage');
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  };

  // Cache All Users dataset in sessionStorage so repeat viewings in current session cost 0 reads
  const getInitialAllUsersCache = (): UserData[] => {
    try {
      const s = sessionStorage.getItem('adminCachedAllUsers');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [usersByPage, setUsersByPage] = useState<Record<number, UserData[]>>(getInitialUsersCache);
  const [allUsers, setAllUsers] = useState<UserData[]>(getInitialAllUsersCache);
  const [lastVisibleByPage, setLastVisibleByPage] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [isFetchingAllUsers, setIsFetchingAllUsers] = useState(false);
  const [allUsersModalOpen, setAllUsersModalOpen] = useState(false);
  const [allUsersError, setAllUsersError] = useState<string | null>(null);
  const [totalProcessedImagesGlobal, setTotalProcessedImagesGlobal] = useState<number | null>(null);
  const [isCalculatingTotal, setIsCalculatingTotal] = useState(false);
  
  // User Deletion State
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  
  // Clean Data Modal & Execution State
  const [globalNotifModalOpen, setGlobalNotifModalOpen] = useState(false);
  const [globalNotifTitle, setGlobalNotifTitle] = useState('');
  const [globalNotifMessage, setGlobalNotifMessage] = useState('');
  const [globalNotifType, setGlobalNotifType] = useState('info');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [cleanModalOpen, setCleanModalOpen] = useState(false);
  const [cleanProgress, setCleanProgress] = useState<{ total: number; current: number; status: 'idle' | 'running' | 'done' | 'error'; message: string }>({
    total: 0,
    current: 0,
    status: 'idle',
    message: ''
  });

  // Server Notification Management State (Independent from user's personal unread bell notifications)
  const [serverNotifications, setServerNotifications] = useState<AppNotification[]>(() => {
    try {
      const s = sessionStorage.getItem('adminCachedServerNotifs');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'global' | 'signups'>('all');
  const [deletingNotifId, setDeletingNotifId] = useState<string | null>(null);
  const [viewingAdminNotif, setViewingAdminNotif] = useState<AppNotification | null>(null);

  // API Keys state
  const [centralKeys, setCentralKeys] = useState<CentralKeyRecord[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [showAddKeyForm, setShowAddKeyForm] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [addKeyError, setAddKeyError] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [keySearchTerm, setKeySearchTerm] = useState('');

  const fetchCentralKeys = async (forceRefresh = false) => {
    setLoadingKeys(true);
    try {
      const data = await fetchAdminCentralKeys(forceRefresh);
      if (Array.isArray(data)) {
        setCentralKeys(data);
      }
    } catch (e) {
      console.error('[Admin Dashboard] Error fetching central keys:', e);
    }
    setLoadingKeys(false);
  };

  useEffect(() => {
    if (activeTab === 'keys') {
      fetchCentralKeys(false);
    }
  }, [activeTab]);

  const handleAddCentralKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyValue.trim()) {
      setAddKeyError('API key string is required');
      return;
    }
    setIsAddingKey(true);
    setAddKeyError(null);
    try {
      await addCentralKeyToFirestore(
        newKeyLabel.trim() || `Central Key ${centralKeys.length + 1}`,
        newKeyValue.trim(),
        currentAdmin?.uid,
        currentAdmin?.email
      );
      setNewKeyLabel('');
      setNewKeyValue('');
      setShowAddKeyForm(false);
      await fetchCentralKeys();
    } catch (err: any) {
      setAddKeyError(err.message || 'Failed to add API key');
    } finally {
      setIsAddingKey(false);
    }
  };

  const copyKeyIdentifier = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const toggleKeyStatus = async (id: string, currentStatus: boolean) => {
    try {
      await toggleCentralKeyStatus(id, !currentStatus);
      setCentralKeys(prev => prev.map(k => k.id === id ? { ...k, enabled: !currentStatus } : k));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteKey = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Central API key from Firestore database?")) return;
    try {
      await deleteCentralKeyFromFirestore(id);
      setCentralKeys(prev => prev.filter(k => k.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch all active notifications directly from server for the Admin Notification Center
  const fetchServerNotifications = async () => {
    if (!db) return;
    setLoadingNotifs(true);
    try {
      const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      recordFirestoreRead('notifications', snap.docs.length || 1, 'AdminDashboard:fetchServerNotifications');
      const list: AppNotification[] = [];
      snap.forEach(d => list.push(d.data() as AppNotification));
      setServerNotifications(list);
      try {
        sessionStorage.setItem('adminCachedServerNotifs', JSON.stringify(list));
      } catch {}
    } catch (e) {
      console.error("Error fetching notifications from server:", e);
    } finally {
      setLoadingNotifs(false);
    }
  };

  // Auto-fetch server notifications when switching to the notifications tab
  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchServerNotifications();
    }
  }, [activeTab]);

  // Delete notification from server (Admin action only)
  const handleDeleteServerNotif = async (id: string) => {
    if (!id) return;
    setDeletingNotifId(id);
    try {
      await deleteNotification(id, true);
      setServerNotifications(prev => {
        const updated = prev.filter(n => n.id !== id);
        try { sessionStorage.setItem('adminCachedServerNotifs', JSON.stringify(updated)); } catch {}
        return updated;
      });
      if (viewingAdminNotif?.id === id) {
        setViewingAdminNotif(null);
      }
    } catch (e) {
      console.error("Failed to delete notification from server:", e);
      alert("Failed to delete notification from server.");
    } finally {
      setDeletingNotifId(null);
    }
  };

  // Guard against duplicate in-flight requests and StrictMode double-mount executions
  const isFetchingRef = useRef(false);
  const initialFetchAttemptedRef = useRef(false);
  const isFetchingAllUsersRef = useRef(false);

  // Sync usersByPage to sessionStorage for 0-cost repeat viewings across routes
  useEffect(() => {
    try {
      if (Object.keys(usersByPage).length > 0) {
        sessionStorage.setItem('adminCachedUsersByPage', JSON.stringify(usersByPage));
      }
    } catch {}
  }, [usersByPage]);

  // Sync allUsers to sessionStorage
  useEffect(() => {
    try {
      if (allUsers.length > 0) {
        sessionStorage.setItem('adminCachedAllUsers', JSON.stringify(allUsers));
      }
    } catch {}
  }, [allUsers]);

  const handleSendGlobalNotification = async () => {
    if (!globalNotifMessage.trim()) return;
    setSendingNotif(true);
    try {
      const notifId = 'global_' + Date.now() + '_' + Math.random().toString(36).substring(2,9);
      const newNotif: AppNotification = {
        id: notifId,
        targetUid: 'all',
        type: globalNotifType,
        userName: globalNotifTitle || 'Global Notice',
        message: globalNotifMessage,
        createdAt: new Date().toISOString(),
        read: false
      };
      await setDoc(doc(db, 'notifications', notifId), newNotif);
      recordFirestoreWrite('notifications', 1, 'AdminDashboard:sendGlobalNotification');
      setServerNotifications(prev => {
        const updated = [newNotif, ...prev.filter(n => n.id !== notifId)];
        try { sessionStorage.setItem('adminCachedServerNotifs', JSON.stringify(updated)); } catch {}
        return updated;
      });
      setGlobalNotifModalOpen(false);
      setGlobalNotifTitle('');
      setGlobalNotifMessage('');
    } catch (e) {
      console.error("Failed to send global notification:", e);
      alert("Failed to send notification.");
    } finally {
      setSendingNotif(false);
    }
  };

  const toggleMaintenance = async () => {
    const newMode = !maintenanceMode;
    setMaintenanceMode(newMode);
    try {
      localStorage.setItem('maintenanceMode', String(newMode));
    } catch {}
    try {
      await setDoc(doc(db, 'settings', 'general'), { maintenanceMode: newMode }, { merge: true });
      recordFirestoreWrite('settings', 1, 'AdminDashboard:toggleMaintenance');
    } catch (e) {
      console.warn("Failed to update maintenance settings in Firestore", e);
    }
  };

  const fetchPage = useCallback(async (page: number, forceRefresh = false) => {
    // Zero-read guarantee: If cached in state and not forcing refresh, do NOT touch Firestore
    if (!forceRefresh && usersByPage[page] && usersByPage[page].length > 0) {
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setLoading(true);
      let q = query(
        collection(db, 'users'), 
        orderBy('totalProcessedImages', 'desc'),
        limit(5)
      );
      
      if (page > 1) {
        const cursor = lastVisibleByPage[page - 1];
        if (!cursor) {
           isFetchingRef.current = false;
           setLoading(false);
           return;
        }
        q = query(
          collection(db, 'users'),
          orderBy('totalProcessedImages', 'desc'),
          startAfter(cursor),
          limit(5)
        );
      }

      const querySnapshot = await getDocs(q);
      recordFirestoreRead('users', querySnapshot.docs.length || 1, 'AdminDashboard:fetchPage');
      const usersData: UserData[] = [];
      querySnapshot.forEach((d) => {
        const u = d.data() as UserData;
        usersData.push(u);
      });

      if (querySnapshot.docs.length > 0) {
        setLastVisibleByPage(prev => ({ ...prev, [page]: querySnapshot.docs[querySnapshot.docs.length - 1] }));
      }
      
      setUsersByPage(prev => ({ ...prev, [page]: usersData }));
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [lastVisibleByPage, usersByPage]);

  // Explicit All Users Fetcher — ONLY executed upon explicit admin confirmation
  const fetchAllUsers = async () => {
    if (isFetchingAllUsersRef.current) return;
    isFetchingAllUsersRef.current = true;
    setIsFetchingAllUsers(true);
    setAllUsersError(null);

    try {
      const q = query(collection(db, 'users'), orderBy('totalProcessedImages', 'desc'));
      const snapshot = await getDocs(q);
      recordFirestoreRead('users', snapshot.docs.length || 1, 'AdminDashboard:fetchAllUsers');
      const list: UserData[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        // Strict allowlist mapping to avoid pulling any unneeded fields
        list.push({
          uid: d.uid || docSnap.id,
          name: d.name || 'User',
          email: d.email || '',
          photoURL: d.photoURL || '',
          nickname: d.nickname || '',
          credits: typeof d.credits === 'number' ? d.credits : 0,
          unlimited: Boolean(d.unlimited),
          totalProcessedImages: typeof d.totalProcessedImages === 'number' ? d.totalProcessedImages : 0,
          plan: d.plan || (d.unlimited ? 'unlimited' : 'free'),
          planStartDate: d.planStartDate || '',
          planEndDate: d.planEndDate || '',
          blocked: Boolean(d.blocked),
          role: d.role || 'user',
          joinDate: d.joinDate || d.createdAt || '',
          createdAt: d.createdAt || d.joinDate || '',
          lastActiveAt: d.lastActiveAt || d.lastLoginAt || d.lastSeen || '',
        } as UserData);
      });

      setAllUsers(list);
      setViewMode('all');
      setAllUsersModalOpen(false);
      try {
        sessionStorage.setItem('adminCachedAllUsers', JSON.stringify(list));
      } catch (e) {
        console.warn("Could not cache all users to sessionStorage:", e);
      }
    } catch (err: any) {
      console.error("Failed to load all users:", err);
      setAllUsersError(err?.message || "Failed to load all users from database.");
    } finally {
      setIsFetchingAllUsers(false);
      isFetchingAllUsersRef.current = false;
    }
  };

  useEffect(() => {
    // Fetch only if page 1 has no cached data and hasn't been fetched yet
    if (currentPage === 1 && !initialFetchAttemptedRef.current) {
      initialFetchAttemptedRef.current = true;
      if (!usersByPage[1] || usersByPage[1].length === 0) {
        fetchPage(1);
      }
    } else if (currentPage > 1) {
      if (!usersByPage[currentPage] || usersByPage[currentPage].length === 0) {
        fetchPage(currentPage);
      }
    }
  }, [currentPage, fetchPage, usersByPage]);

  // Search executes on explicit user action (button click or Enter key)
  const handleSearch = async () => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      if (viewMode === 'paginated') {
        fetchPage(1, true);
      }
      return;
    }
    setLoading(true);
    try {
      let candidateUsers = allUsers;
      if (!candidateUsers || candidateUsers.length === 0) {
        const snap = await getDocs(collection(db, 'users'));
        recordFirestoreRead('users', snap.docs.length || 1, 'AdminDashboard:searchUsers');
        const list: UserData[] = [];
        snap.forEach(d => list.push(d.data() as UserData));
        candidateUsers = list;
        setAllUsers(list);
        try {
          sessionStorage.setItem('adminCachedAllUsers', JSON.stringify(list));
        } catch {}
      }

      const res = candidateUsers.filter(u => 
        (u.email && u.email.toLowerCase().includes(term)) ||
        (u.name && u.name.toLowerCase().includes(term)) ||
        (u.nickname && u.nickname.toLowerCase().includes(term)) ||
        (u.uid && u.uid.toLowerCase().includes(term)) ||
        (u.plan && u.plan.toLowerCase().includes(term))
      );

      if (viewMode === 'all') {
        // In all mode, filteredUsers will automatically reflect this
      } else {
        setUsersByPage({ 1: res });
        setCurrentPage(1);
      }
    } catch (e) {
      console.error("Search query error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (uid: string, updates: Partial<UserData>) => {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
      recordFirestoreWrite('users', 1, 'AdminDashboard:updateUser');
      setUsersByPage(prev => {
        const next = { ...prev };
        for (const p of Object.keys(next)) {
           const pageNum = Number(p);
           next[pageNum] = (next[pageNum] || []).map(u => u.uid === uid ? { ...u, ...updates } : u);
        }
        return next;
      });
      setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updates } : u));
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete || !db) return;
    setIsDeletingUser(true);
    try {
      const uid = userToDelete.uid;
      await deleteDoc(doc(db, 'users', uid));
      recordFirestoreWrite('users', 1, 'AdminDashboard:deleteUser');

      // Remove from paginated state and sessionStorage cache
      setUsersByPage(prev => {
        const next = { ...prev };
        for (const p of Object.keys(next)) {
          const pageNum = Number(p);
          next[pageNum] = (next[pageNum] || []).filter(u => u.uid !== uid);
        }
        try {
          sessionStorage.setItem('adminCachedUsersByPage', JSON.stringify(next));
        } catch {}
        return next;
      });

      // Remove from allUsers state and sessionStorage cache
      setAllUsers(prev => {
        const next = prev.filter(u => u.uid !== uid);
        try {
          sessionStorage.setItem('adminCachedAllUsers', JSON.stringify(next));
        } catch {}
        return next;
      });

      setUserToDelete(null);
    } catch (error: any) {
      console.error("Error deleting user from database:", error);
      alert(`Failed to delete user: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handlePlanChange = (uid: string, newPlan: string) => {
    const start = new Date();
    const end = new Date();
    let newCredits = 0;
    let unlimited = false;

    if (newPlan === 'starter') {
       end.setMonth(end.getMonth() + 1);
       newCredits = 2000;
    } else if (newPlan === 'pro') {
       end.setMonth(end.getMonth() + 2);
       newCredits = 5000;
    } else if (newPlan === 'elite') {
       end.setMonth(end.getMonth() + 6);
       newCredits = 10000;
    } else if (newPlan === 'unlimited') {
       end.setFullYear(end.getFullYear() + 100);
       unlimited = true;
       newCredits = -1;
    } else {
       newPlan = 'free';
    }

    handleUpdateUser(uid, {
       plan: newPlan as any,
       credits: newCredits,
       unlimited,
       planStartDate: start.toISOString(),
       planEndDate: end.toISOString()
    });
  };

  const handleCalculateTotalImages = async () => {
    setIsCalculatingTotal(true);
    setTotalProcessedImagesGlobal(null);
    try {
      let candidateUsers = allUsers;
      if (!candidateUsers || candidateUsers.length === 0) {
        const snap = await getDocs(collection(db, 'users'));
        recordFirestoreRead('users', snap.docs.length || 1, 'AdminDashboard:calculateTotalImages');
        const list: UserData[] = [];
        snap.forEach(d => list.push(d.data() as UserData));
        candidateUsers = list;
        setAllUsers(list);
        try {
          sessionStorage.setItem('adminCachedAllUsers', JSON.stringify(list));
        } catch {}
      }
      
      const total = candidateUsers.reduce((acc, user) => acc + (user.totalProcessedImages || 0), 0);
      setTotalProcessedImagesGlobal(total);
    } catch (e) {
      console.error("Failed to calculate total images:", e);
    } finally {
      setIsCalculatingTotal(false);
    }
  };

  /**
   * CLEAN USER DATA:
   * Replaces every user document in Firestore with ONLY strictly allowlisted fields.
   * Eliminates bloated history arrays, cached appdata, session logs, totalTime, blockedIPs, and telemetry.
   * Preserves user account existence and essential administrative fields.
   */
  const executeCleanUserData = async () => {
    setCleanProgress({
      total: 0,
      current: 0,
      status: 'running',
      message: 'Scanning all user records in Firestore...'
    });

    try {
      const snap = await getDocs(collection(db, 'users'));
      recordFirestoreRead('users', snap.docs.length || 1, 'AdminDashboard:cleanUserData');
      const total = snap.docs.length;
      let count = 0;

      for (const d of snap.docs) {
        count++;
        const raw = d.data();

        // Construct document using ONLY explicit allowlisted essential fields
        const cleanDoc: Record<string, any> = {
          uid: raw.uid || d.id,
          name: raw.name || 'User',
          email: raw.email || '',
          nickname: raw.nickname || '',
          credits: typeof raw.credits === 'number' ? raw.credits : 0,
          totalProcessedImages: typeof raw.totalProcessedImages === 'number' ? raw.totalProcessedImages : 0,
          plan: raw.plan || (raw.unlimited ? 'unlimited' : 'free'),
          planStartDate: raw.planStartDate || null,
          planEndDate: raw.planEndDate || null,
          unlimited: Boolean(raw.unlimited),
          blocked: Boolean(raw.blocked),
          centralApiAccess: Boolean(raw.centralApiAccess),
          role: raw.role || 'user',
          joinDate: raw.joinDate || raw.createdAt || new Date().toISOString(),
          createdAt: raw.createdAt || raw.joinDate || new Date().toISOString(),
          photoURL: raw.photoURL || ''
        };

        setCleanProgress({
          total,
          current: count,
          status: 'running',
          message: `Sanitizing document ${count} of ${total} (${raw.email || d.id})...`
        });

        // 1 controlled overwrite write per document with strict allowlist (no merge: true)
        await setDoc(doc(db, 'users', d.id), cleanDoc).then(() => {
          recordFirestoreWrite('users', 1, 'AdminDashboard:cleanDoc');
        }).catch(err => {
          console.warn(`Could not sanitize doc ${d.id}:`, err);
        });
      }

      setCleanProgress({
        total,
        current: total,
        status: 'done',
        message: `Successfully cleaned all ${total} user documents! All unlisted history, appdata, and telemetry fields have been completely purged.`
      });

      // Clear session cache and reload page 1
      sessionStorage.removeItem('adminCachedUsersByPage');
      setUsersByPage({});
      setLastVisibleByPage({});
      setTimeout(() => {
        fetchPage(1, true);
      }, 1000);

    } catch (e: any) {
      console.error("Error during database cleaning:", e);
      setCleanProgress({
        total: 0,
        current: 0,
        status: 'error',
        message: `Failed to clean database: ${e?.message || 'Unknown error'}`
      });
    }
  };

  const users = usersByPage[currentPage] || [];
  const totalSiteImages = Object.values(usersByPage).flat().reduce((acc, u: any) => acc + (u.totalProcessedImages || 0), 0);

  const filteredUsers = useMemo(() => {
    let list: UserData[] = [];
    const term = searchTerm.trim().toLowerCase();

    if (viewMode === 'all') {
      if (term) {
        list = allUsers.filter(u => 
          (u.email && u.email.toLowerCase().includes(term)) ||
          (u.name && u.name.toLowerCase().includes(term)) ||
          (u.nickname && u.nickname.toLowerCase().includes(term)) ||
          (u.uid && u.uid.toLowerCase().includes(term)) ||
          (u.plan && u.plan.toLowerCase().includes(term))
        );
      } else {
        list = [...allUsers];
      }
    } else {
      if (term) {
        list = users.filter(u => 
          (u.email && u.email.toLowerCase().includes(term)) ||
          (u.name && u.name.toLowerCase().includes(term)) ||
          (u.nickname && u.nickname.toLowerCase().includes(term)) ||
          (u.uid && u.uid.toLowerCase().includes(term)) ||
          (u.plan && u.plan.toLowerCase().includes(term))
        );
      } else {
        list = [...users];
      }
    }

    const getAvgPerDay = (u: UserData) => {
      if (!u.joinDate) return 0;
      const join = new Date(u.joinDate);
      const days = Math.max(1, Math.floor((Date.now() - join.getTime()) / (1000 * 60 * 60 * 24)));
      return Math.round((u.totalProcessedImages || 0) / days);
    };

    switch (sortBy) {
      case 'recent_active':
        // Default: Sort by activity / login / join timestamp descending
        return list.sort((a, b) => {
          const timeA = new Date((a as any).lastActiveAt || (a as any).lastLoginAt || (a as any).lastSeen || a.planStartDate || a.joinDate || 0).getTime();
          const timeB = new Date((b as any).lastActiveAt || (b as any).lastLoginAt || (b as any).lastSeen || b.planStartDate || b.joinDate || 0).getTime();
          if (timeB !== timeA) return timeB - timeA;
          return (b.totalProcessedImages || 0) - (a.totalProcessedImages || 0);
        });
      case 'recently_signed_up':
        // Newest joinDate / createdAt first
        return list.sort((a, b) => {
          const timeA = new Date(a.joinDate || (a as any).createdAt || 0).getTime();
          const timeB = new Date(b.joinDate || (b as any).createdAt || 0).getTime();
          return timeB - timeA;
        });
      case 'top_users':
        // Highest Avg/Day first
        return list.sort((a, b) => getAvgPerDay(b) - getAvgPerDay(a));
      case 'least_active':
        // Lowest Avg/Day first
        return list.sort((a, b) => getAvgPerDay(a) - getAvgPerDay(b));
      default:
        return list;
    }
  }, [users, allUsers, viewMode, searchTerm, sortBy]);

  return (
    <>
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex-1 w-full h-full overflow-y-auto p-4 sm:p-8 custom-scrollbar min-h-0"
    >
      <div className="max-w-7xl mx-auto space-y-8 pb-24">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-emerald-400" />
            Admin Dashboard
          </h1>
          
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleCalculateTotalImages}
              disabled={isCalculatingTotal}
              className="flex items-center gap-2 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/80 rounded-xl px-4 py-2 text-sm font-bold text-emerald-300 transition-colors shadow-lg disabled:opacity-50"
              title="Count total on-site processed images across all users"
            >
              {isCalculatingTotal ? (
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              ) : (
                <ImageIcon className="w-4 h-4 text-emerald-400" />
              )}
              {totalProcessedImagesGlobal !== null 
                ? `Total Images: ${totalProcessedImagesGlobal.toLocaleString()}`
                : 'Count Total Processed Images'
              }
            </button>

            <button
              onClick={() => setGlobalNotifModalOpen(true)}
              className="flex items-center gap-2 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/80 rounded-xl px-4 py-2 text-sm font-bold text-purple-300 transition-colors shadow-lg"
              title="Broadcast a global announcement to all users"
            >
              <Bell className="w-4 h-4 text-purple-400" />
              Send Notification
            </button>

            <button
              onClick={() => fetchPage(currentPage, true)}
              className="flex items-center gap-2 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-purple-400" />
              Refresh Data
            </button>

            <button
              onClick={() => setCleanModalOpen(true)}
              className="flex items-center gap-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 rounded-xl px-4 py-2 text-sm font-bold text-rose-300 transition-colors shadow-lg"
              title="Delete legacy history/appdata bloat from all users while preserving essential accounts"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              Clean User Data
            </button>

            <label className="flex items-center gap-2 cursor-pointer bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2 shadow-lg">
                <input type="checkbox" checked={maintenanceMode} onChange={toggleMaintenance} className="w-4 h-4 accent-red-500" />
                <span className="text-sm font-bold text-red-400">Maintenance Mode</span>
            </label>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-2 sm:gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2.5 pb-3 px-1 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User Management</span>
          </button>
          
          <button
            onClick={() => {
              setActiveTab('notifications');
              if (serverNotifications.length === 0) {
                fetchServerNotifications();
              }
            }}
            className={`flex items-center gap-2.5 pb-3 px-1 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'notifications'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notification Center</span>
            {serverNotifications.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold">
                {serverNotifications.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('keys');
              if (centralKeys.length === 0) {
                fetchCentralKeys();
              }
            }}
            className={`flex items-center gap-2.5 pb-3 px-1 font-bold text-sm transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'keys'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Central API Keys</span>
          </button>
        </div>

        {/* TAB 1: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6">
                <div className="flex-1 flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <Search className="w-5 h-5 text-slate-500 ml-2 shrink-0" />
                  <input 
                    type="text" 
                    placeholder="Search by name, email, nickname, UID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="bg-transparent border-none outline-none text-slate-200 w-full py-1 text-sm placeholder:text-slate-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        if (viewMode === 'paginated') {
                          fetchPage(1, true);
                        }
                      }}
                      className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-md transition-colors shrink-0"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white rounded-lg transition-colors shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Search DB</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      if (viewMode === 'paginated') {
                        if (allUsers.length > 0) {
                          // Already cached in memory / session storage! 0 Firestore reads needed
                          setViewMode('all');
                        } else {
                          setAllUsersModalOpen(true);
                        }
                      } else {
                        setViewMode('paginated');
                      }
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border shadow-sm ${
                      viewMode === 'all'
                        ? 'bg-purple-900/60 border-purple-600 text-purple-200 hover:bg-purple-900/80 shadow-purple-900/20'
                        : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                    }`}
                    title={viewMode === 'all' ? "Switch to standard paginated view" : "Fetch all users into a single view"}
                  >
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>{viewMode === 'all' ? 'Paginated View' : 'All Users'}</span>
                    {viewMode === 'all' && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-[10px] font-mono text-purple-300">
                        {allUsers.length}
                      </span>
                    )}
                  </button>

                  <div className="flex items-center gap-2 bg-slate-950 p-2 px-3.5 rounded-xl border border-slate-800 shrink-0">
                    <ArrowUpDown className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Sort By:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="bg-transparent border-none outline-none text-xs font-bold text-purple-300 cursor-pointer pr-1"
                    >
                      <option value="recent_active" className="bg-slate-900 text-slate-200">Recent Active Users</option>
                      <option value="recently_signed_up" className="bg-slate-900 text-slate-200">Recently Signed Up</option>
                      <option value="top_users" className="bg-slate-900 text-slate-200">Top Users</option>
                      <option value="least_active" className="bg-slate-900 text-slate-200">Least Active Users</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-sm">
                      <th className="pb-3 font-semibold w-16">Rank</th>
                      <th className="pb-3 font-semibold w-1/4">User</th>
                      <th className="pb-3 font-semibold">Nickname</th>
                      <th className="pb-3 font-semibold">Credits</th>
                      <th className="pb-3 font-semibold">Plan & Validity</th>
                      <th className="pb-3 font-semibold">Central API</th>
                      <th className="pb-3 font-semibold">Processed</th>
                      <th className="pb-3 font-semibold">Avg/Day</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold text-right pr-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(loading || isFetchingAllUsers) ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                            <span className="text-sm font-medium">
                              {isFetchingAllUsers ? 'Retrieving all user accounts from database...' : 'Loading users...'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr><td colSpan={10} className="py-8 text-center text-slate-500">No users found.</td></tr>
                    ) : (
                      filteredUsers.map((user, index) => {
                            const rank = viewMode === 'all' ? index + 1 : (currentPage - 1) * 5 + index + 1;
                            let avgPerDay = 0;
                            if (user.joinDate) {
                              const joinDate = new Date(user.joinDate);
                              const days = Math.max(1, Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24)));
                              avgPerDay = Math.round((user.totalProcessedImages || 0) / days);
                            }
                            return (
                          <tr key={user.uid} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-4 font-bold text-slate-400">#{rank}</td>
                            <td className="py-4">
                              <div className="flex items-center gap-3">
                                <img src={user.photoURL || 'https://via.placeholder.com/32'} alt="" className="w-8 h-8 rounded-full" />
                                <div>
                                  <div className="font-medium text-slate-200">{user.name || 'User'}</div>
                                  <div className="text-xs text-slate-500">{user.email}</div>
                                </div>
                              </div>
                            </td>
                            
                            <td className="py-4 text-slate-300">
                               <input 
                                  type="text" 
                                  value={user.nickname || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (viewMode === 'all') {
                                      setAllUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, nickname: val } : u));
                                    } else {
                                      setUsersByPage(prev => ({...prev, [currentPage]: (prev[currentPage] || []).map(u => u.uid === user.uid ? {...u, nickname: val} : u)}));
                                    }
                                  }}
                                  onBlur={(e) => handleUpdateUser(user.uid, { nickname: e.target.value })}
                                  className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-purple-500"
                               />
                            </td>
                            
                            <td className="py-4 text-slate-300 font-mono">
                                <input 
                                  type="number" 
                                  value={user.credits}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    if (viewMode === 'all') {
                                      setAllUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, credits: val } : u));
                                    } else {
                                      setUsersByPage(prev => ({...prev, [currentPage]: (prev[currentPage] || []).map(u => u.uid === user.uid ? {...u, credits: val} : u)}));
                                    }
                                  }}
                                  onBlur={(e) => handleUpdateUser(user.uid, { credits: parseInt(e.target.value) || 0 })}
                                  className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-purple-500"
                                />
                            </td>
                            
                            <td className="py-4">
                               <div className="flex flex-col gap-1">
                                <select
                                  value={user.plan || (user.unlimited ? 'unlimited' : (user.credits >= 5000 ? 'pro' : 'free'))}
                                  onChange={(e) => handlePlanChange(user.uid, e.target.value)}
                                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm outline-none text-slate-200 capitalize w-28"
                                >
                                  <option value="free">Free</option>
                                  <option value="starter">Starter</option>
                                  <option value="pro">Pro</option>
                                  <option value="elite">Elite</option>
                                  <option value="unlimited">Unlimited</option>
                                </select>
                                {user.plan && user.plan !== 'free' && user.planStartDate && (
                                    <span className="text-[10px] text-slate-500">
                                       From: {new Date(user.planStartDate).toLocaleDateString()}
                                    </span>
                                )}
                               </div>
                            </td>
                            
                            <td className="py-4">
                               <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                 <input 
                                   type="checkbox" 
                                   checked={user.role === 'admin' || user.centralApiAccess === true}
                                   onChange={(e) => {
                                     const val = e.target.checked;
                                     if (viewMode === 'all') {
                                       setAllUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, centralApiAccess: val } : u));
                                     } else {
                                       setUsersByPage(prev => ({
                                         ...prev, 
                                         [currentPage]: (prev[currentPage] || []).map(u => u.uid === user.uid ? { ...u, centralApiAccess: val } : u)
                                       }));
                                     }
                                     handleUpdateUser(user.uid, { centralApiAccess: val });
                                   }}
                                   disabled={user.role === 'admin'}
                                   className="w-4 h-4 accent-purple-600 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                                 />
                                 <span className="text-xs">
                                   {user.role === 'admin' || user.centralApiAccess ? (
                                     <span className="text-purple-400 font-semibold flex items-center gap-1">
                                       <Zap className="w-3 h-3 text-purple-400 shrink-0" /> Granted
                                     </span>
                                   ) : (
                                     <span className="text-slate-500 font-medium">Locked</span>
                                   )}
                                 </span>
                               </label>
                            </td>

                            <td className="py-4 font-bold text-white">
                              {(user.totalProcessedImages || 0).toLocaleString()}
                            </td>
                            <td className="py-4 text-emerald-400 font-medium">
                              {avgPerDay.toLocaleString()}/d
                            </td>
                            
                            <td className="py-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={user.blocked || false}
                                    onChange={(e) => handleUpdateUser(user.uid, { blocked: e.target.checked })}
                                    disabled={user.uid === currentAdmin?.uid}
                                    className="w-4 h-4 accent-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <span className="text-sm text-slate-400">{user.blocked ? <span className="text-red-400">Blocked</span> : <span className="text-emerald-400">Active</span>}</span>
                                </label>
                            </td>

                            <td className="py-4 text-right pr-3">
                                <button 
                                  onClick={() => setUserToDelete(user)}
                                  disabled={user.uid === currentAdmin?.uid}
                                  className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 hover:border-rose-600 text-rose-400 hover:text-rose-300 rounded-lg transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-rose-950/40 inline-flex items-center justify-center group"
                                  title={user.uid === currentAdmin?.uid ? "You cannot delete your own admin account" : `Delete ${user.name || user.email || 'user'} from database`}
                                >
                                  <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                </button>
                            </td>
                          </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>

              {viewMode === 'all' ? (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                    <span>
                      {searchTerm.trim() ? (
                        <>Matching <strong className="text-purple-300 font-semibold">{filteredUsers.length}</strong> of {allUsers.length} total user accounts</>
                      ) : (
                        <>Showing all <strong className="text-purple-300 font-semibold">{filteredUsers.length}</strong> loaded user accounts on a single page</>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => setViewMode('paginated')}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition-colors"
                  >
                    Switch back to Paginated View
                  </button>
                </div>
              ) : searchTerm.trim() ? (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 gap-3">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-purple-400" />
                    <span>
                      Found <strong className="text-purple-300 font-semibold">{filteredUsers.length}</strong> matching user{filteredUsers.length === 1 ? '' : 's'} for "<span className="text-slate-200">{searchTerm}</span>"
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      fetchPage(1, true);
                    }}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition-colors"
                  >
                    Clear Search & View All
                  </button>
                </div>
              ) : (
                <div className="flex justify-center mt-6 items-center gap-4">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loading}
                      className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm text-slate-300 transition-colors disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="text-slate-400 text-sm font-bold">Page {currentPage}</span>
                    <button 
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={users.length < 5 || loading}
                      className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm text-slate-300 transition-colors disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: NOTIFICATION CENTER (Server Management) */}
        {activeTab === 'notifications' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active on Server</span>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                    <Bell className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mt-2">{serverNotifications.length}</div>
                <div className="text-xs text-slate-500 mt-1">Live Firestore notification documents</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Global Announcements</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Globe className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-2">
                  {serverNotifications.filter(n => n.targetUid === 'all').length}
                </div>
                <div className="text-xs text-slate-500 mt-1">Broadcasts visible to all users</div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Signup Alerts</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <UserPlus className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-blue-400 mt-2">
                  {serverNotifications.filter(n => n.targetUid === 'admin').length}
                </div>
                <div className="text-xs text-slate-500 mt-1">New user registration notifications</div>
              </div>
            </div>

            {/* Management Panel */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              {/* Header & Filter Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  {[
                    { id: 'all', label: `All (${serverNotifications.length})` },
                    { id: 'global', label: `Global (${serverNotifications.filter(n => n.targetUid === 'all').length})` },
                    { id: 'signups', label: `Signups (${serverNotifications.filter(n => n.targetUid === 'admin').length})` },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setNotifFilter(f.id as any)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        notifFilter === f.id
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={fetchServerNotifications}
                    disabled={loadingNotifs}
                    className="flex items-center gap-2 px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${loadingNotifs ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={() => setGlobalNotifModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-900/30"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Announcement</span>
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              {loadingNotifs ? (
                <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  <span className="text-sm font-medium">Loading notifications from server...</span>
                </div>
              ) : serverNotifications.length === 0 ? (
                <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500/50" />
                  </div>
                  <div className="font-bold text-slate-300 text-base">No Active Notifications on Server</div>
                  <div className="text-xs text-slate-500 max-w-sm">
                    All notifications have been viewed or deleted. Use "Send Announcement" above to broadcast a notice to all users.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {serverNotifications
                    .filter(n => {
                      if (notifFilter === 'global') return n.targetUid === 'all';
                      if (notifFilter === 'signups') return n.targetUid === 'admin';
                      return true;
                    })
                    .map(n => {
                      const isGlobal = n.targetUid === 'all';
                      const isDeleting = deletingNotifId === n.id;
                      return (
                        <div
                          key={n.id}
                          className="bg-slate-950/70 border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-4 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Type Badge */}
                              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                isGlobal
                                  ? (n.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : n.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20')
                                  : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              }`}>
                                {isGlobal ? (
                                  n.type === 'warning' ? <AlertTriangle className="w-3 h-3" /> :
                                  n.type === 'success' ? <CheckCircle className="w-3 h-3" /> :
                                  <Info className="w-3 h-3" />
                                ) : (
                                  <UserPlus className="w-3 h-3" />
                                )}
                                <span className="capitalize">{n.type || 'Notice'}</span>
                              </span>

                              {/* Target Badge */}
                              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                                isGlobal ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {isGlobal ? <Globe className="w-3 h-3 text-emerald-400" /> : <Shield className="w-3 h-3 text-purple-400" />}
                                <span>{isGlobal ? 'Global (All Users)' : 'Admin Only'}</span>
                              </span>

                              {/* Timestamp */}
                              <span className="text-[11px] text-slate-500">
                                {n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Unknown date'}
                              </span>
                            </div>

                            <div className="font-bold text-sm text-slate-200 truncate">
                              {n.userName || (isGlobal ? 'Global Notice' : 'New User Signup')}
                            </div>

                            <div className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {n.message}
                            </div>

                            {n.userEmail && (
                              <div className="text-[11px] text-purple-300 font-mono pt-0.5">
                                User Email: {n.userEmail}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-850">
                            <button
                              onClick={() => setViewingAdminNotif(n)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              title="Preview notification"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            <button
                              onClick={() => handleDeleteServerNotif(n.id)}
                              disabled={isDeleting}
                              className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 hover:text-rose-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
                              title="Delete permanently from Firestore server"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              )}
                              <span>Delete from Server</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Clean Database Modal */}
      {cleanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
           <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
              <div className="flex items-center gap-3 mb-4">
                 <Trash2 className="w-6 h-6 text-rose-400" />
                 <h3 className="text-xl font-bold text-white">Clean User Database</h3>
              </div>

              <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                This process purges bloated history logs, appdata configuration caches, and legacy telemetry from user documents in Firestore, replacing them with a strictly allowlisted account schema.
              </p>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 mb-6 space-y-2 text-xs">
                <div className="text-emerald-400 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Preserved Allowlist Fields:
                </div>
                <div className="text-slate-400 pl-6">
                  uid, name, email, nickname, credits, totalProcessedImages, plan, planStartDate, planEndDate, unlimited, blocked, role, joinDate / createdAt, photoURL.
                </div>

                <div className="text-rose-400 font-semibold flex items-center gap-2 mt-3">
                  <Trash2 className="w-4 h-4" />
                  Purged Unlisted Data:
                </div>
                <div className="text-slate-400 pl-6">
                  Embedded <code className="text-rose-300">history</code> arrays (1,000+ items per user), <code className="text-rose-300">appdata</code> config maps, <code className="text-rose-300">totalTime</code>, <code className="text-rose-300">blockedIPs</code>, and raw telemetry.
                </div>
              </div>

              {cleanProgress.status === 'running' && (
                <div className="mb-6 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-2 text-purple-400 font-semibold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sanitizing documents...
                    </span>
                    <span>{cleanProgress.current} / {cleanProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-rose-500 transition-all duration-300"
                      style={{ width: `${cleanProgress.total ? (cleanProgress.current / cleanProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">{cleanProgress.message}</p>
                </div>
              )}

              {cleanProgress.status === 'done' && (
                <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400">
                  {cleanProgress.message}
                </div>
              )}

              {cleanProgress.status === 'error' && (
                <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                  {cleanProgress.message}
                </div>
              )}

               <div className="flex gap-3 justify-end">
                 <button 
                   onClick={() => {
                     setCleanModalOpen(false);
                     setCleanProgress({ total: 0, current: 0, status: 'idle', message: '' });
                   }} 
                   disabled={cleanProgress.status === 'running'}
                   className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 font-semibold text-sm disabled:opacity-50"
                 >
                   {cleanProgress.status === 'done' ? 'Close' : 'Cancel'}
                 </button>
                 {cleanProgress.status !== 'done' && (
                   <button 
                     onClick={executeCleanUserData} 
                     disabled={cleanProgress.status === 'running'} 
                     className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                   >
                     {cleanProgress.status === 'running' ? (
                       <>
                         <Loader2 className="w-4 h-4 animate-spin" />
                         Cleaning...
                       </>
                     ) : (
                       <>
                         <Trash2 className="w-4 h-4" />
                         Start Clean Data
                       </>
                     )}
                   </button>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Global Notification Composer Modal */}
      {globalNotifModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-purple-400 font-bold text-lg">
                <Bell className="w-5 h-5" />
                <span>Send Global Notification</span>
              </div>
              <button
                onClick={() => setGlobalNotifModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Type / Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Notification Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'info', label: 'Info', icon: Info, color: 'text-blue-400 border-blue-500/40 bg-blue-950/30' },
                    { id: 'warning', label: 'Warning', icon: AlertTriangle, color: 'text-amber-400 border-amber-500/40 bg-amber-950/30' },
                    { id: 'success', label: 'Success', icon: CheckCircle, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setGlobalNotifType(t.id)}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        globalNotifType === t.id
                          ? `${t.color} ring-1 ring-white/20 shadow-md`
                          : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:bg-slate-800/50'
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title input */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Notification Title <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. System Update, Maintenance Notice..."
                  value={globalNotifTitle}
                  onChange={(e) => setGlobalNotifTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Message input */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Notification Message <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Write your announcement to all users here..."
                  value={globalNotifMessage}
                  onChange={(e) => setGlobalNotifMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-sm text-slate-200 outline-none focus:border-purple-500 transition-colors custom-scrollbar resize-none leading-relaxed"
                />
              </div>

              {/* Live Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">Live User Preview</label>
                <div className="p-3.5 rounded-xl border border-slate-800 bg-gradient-to-r from-purple-900/30 to-emerald-900/10 shadow-[inset_3px_0_0_0_#a855f7]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                      globalNotifType === 'warning' ? 'text-amber-400' : globalNotifType === 'success' ? 'text-emerald-400' : 'text-blue-400'
                    }`}>
                      {globalNotifType === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> : globalNotifType === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                      <span>{globalNotifTitle.trim() || 'Global Notice'}</span>
                    </div>
                    <span className="text-[10px] text-purple-300 font-medium px-1.5 py-0.5 rounded bg-purple-500/20">
                      View
                    </span>
                  </div>
                  <div className="text-xs text-purple-50 leading-relaxed whitespace-pre-line">
                    {globalNotifMessage.trim() || 'Your notification text will appear here...'}
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1.5 mt-1.5 border-t border-slate-800/50">
                    Just now • Target: All Users (1 document)
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setGlobalNotifModalOpen(false)}
                disabled={sendingNotif}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 font-semibold text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendGlobalNotification}
                disabled={sendingNotif || !globalNotifMessage.trim()}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingNotif ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send to All Users
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CENTRAL API KEYS */}
      {activeTab === 'keys' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Database Keys</p>
                  <p className="text-2xl font-bold text-white mt-1">{centralKeys.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Key className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">All API keys stored in server database</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Active Pool Capacity</p>
                  <p className="text-2xl font-bold text-emerald-300 mt-1">
                    {centralKeys.filter(k => k.enabled).length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">Currently used for Central API parallel load balancing</p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Disabled Keys</p>
                  <p className="text-2xl font-bold text-slate-300 mt-1">
                    {centralKeys.filter(k => !k.enabled).length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">Paused keys excluded from concurrent dispatch</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-purple-400" />
                  Central API Keys Database
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Crowdsourced & system API keys stored in server database for multi-node generation.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowAddKeyForm(prev => !prev)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-600/20 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showAddKeyForm ? 'Cancel' : 'Add API Key'}</span>
                </button>

                <button 
                  onClick={() => fetchCentralKeys(true)}
                  disabled={loadingKeys}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition-colors border border-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  {loadingKeys ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-purple-400" />}
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Manual Add Key Form */}
            {showAddKeyForm && (
              <form onSubmit={handleAddCentralKey} className="p-5 bg-slate-950/70 border border-purple-500/30 rounded-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-purple-400" />
                    Add New Key to Central Database
                  </h4>
                  <span className="text-[11px] text-slate-400">Encrypted with AES-256-GCM on server</span>
                </div>

                {addKeyError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{addKeyError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Key Label / Owner (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g., Primary Admin Node or User Batch"
                      value={newKeyLabel}
                      onChange={(e) => setNewKeyLabel(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Gemini API Key (AIzaSy...)</label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddKeyForm(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingKey || !newKeyValue.trim()}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
                  >
                    {isAddingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>Save Key to Database</span>
                  </button>
                </div>
              </form>
            )}

            {/* Search and Table */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800 max-w-md">
                <Search className="w-4 h-4 text-slate-500 ml-2 shrink-0" />
                <input 
                  type="text" 
                  placeholder="Filter keys by label or masked identifier..." 
                  value={keySearchTerm}
                  onChange={(e) => setKeySearchTerm(e.target.value)}
                  className="bg-transparent border-none outline-none text-slate-200 w-full py-1 text-sm placeholder:text-slate-500"
                />
                {keySearchTerm && (
                  <button
                    type="button"
                    onClick={() => setKeySearchTerm('')}
                    className="text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5"
                  >
                    Clear
                  </button>
                )}
              </div>

              {centralKeys.length === 0 && !loadingKeys ? (
                <div className="text-center py-12 bg-slate-950/50 rounded-xl border border-slate-800 border-dashed space-y-2">
                  <Key className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-300 font-semibold text-sm">No Central API Keys in Database</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Keys are automatically contributed when users add or import keys locally, or you can add keys directly using the button above.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold">Label / Origin</th>
                        <th className="p-4 font-semibold">Masked API Key</th>
                        <th className="p-4 font-semibold">Contributor</th>
                        <th className="p-4 font-semibold">Added On</th>
                        <th className="p-4 font-semibold">Status</th>
                        <th className="p-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-slate-300 divide-y divide-slate-800/50">
                      {centralKeys
                        .filter(k => {
                          if (!keySearchTerm) return true;
                          const q = keySearchTerm.toLowerCase();
                          return (
                            (k.label && k.label.toLowerCase().includes(q)) ||
                            (k.maskedKey && k.maskedKey.toLowerCase().includes(q)) ||
                            (k.contributorEmail && k.contributorEmail.toLowerCase().includes(q)) ||
                            k.id.toLowerCase().includes(q)
                          );
                        })
                        .map((key, idx) => (
                          <tr key={key.id} className="hover:bg-slate-800/20 transition-colors group">
                            <td className="p-4 font-medium text-slate-200">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold shrink-0">
                                  #{idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <span className="truncate block font-semibold text-slate-100">{key.label || 'User Contributed Key'}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">ID: {key.id.slice(0, 8)}...</span>
                                </div>
                              </div>
                            </td>

                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                                  {key.maskedKey || '••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyKeyIdentifier(key.id, key.maskedKey || key.id)}
                                  className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded transition-colors"
                                  title="Copy Key Identifier"
                                >
                                  {copiedKeyId === key.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            <td className="p-4 text-xs text-slate-300">
                              <span className="bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-400 font-mono text-[11px] truncate max-w-[150px] inline-block">
                                {key.contributorEmail || key.contributedBy || 'User'}
                              </span>
                            </td>

                            <td className="p-4 text-xs text-slate-400">
                              {key.createdAt ? new Date(key.createdAt).toLocaleString() : 'N/A'}
                            </td>

                            <td className="p-4">
                              <button 
                                onClick={() => toggleKeyStatus(key.id, key.enabled)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-full uppercase transition-all cursor-pointer ${
                                  key.enabled 
                                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30' 
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                                }`}
                              >
                                {key.enabled ? 'Active / Enabled' : 'Disabled'}
                              </button>
                            </td>

                            <td className="p-4 text-right">
                              <button
                                onClick={() => deleteKey(key.id)}
                                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Delete Key from Central Pool"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Notification Preview & Deletion Modal */}
      {viewingAdminNotif && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  viewingAdminNotif.targetUid === 'all'
                    ? (viewingAdminNotif.type === 'warning' ? 'bg-amber-500/10 text-amber-400' : viewingAdminNotif.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400')
                    : 'bg-purple-500/10 text-purple-400'
                }`}>
                  {viewingAdminNotif.targetUid === 'all' ? (
                    viewingAdminNotif.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
                    viewingAdminNotif.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                    <Info className="w-5 h-5" />
                  ) : (
                    <UserPlus className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-lg">
                    {viewingAdminNotif.userName || (viewingAdminNotif.targetUid === 'all' ? 'Global Notice' : 'New User Registration')}
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{viewingAdminNotif.createdAt ? new Date(viewingAdminNotif.createdAt).toLocaleString() : 'Unknown date'}</span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-slate-400">ID: {viewingAdminNotif.id}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setViewingAdminNotif(null)}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                viewingAdminNotif.targetUid === 'all' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
              }`}>
                {viewingAdminNotif.targetUid === 'all' ? <Globe className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                <span>{viewingAdminNotif.targetUid === 'all' ? 'Broadcast to All Users' : 'Direct Admin Alert'}</span>
              </span>

              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400">
                <span>Category:</span>
                <span className="font-semibold text-slate-200 capitalize">{viewingAdminNotif.type || 'Standard'}</span>
              </span>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Message Content</div>
              <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {viewingAdminNotif.message}
              </div>

              {viewingAdminNotif.userEmail && (
                <div className="pt-2 border-t border-slate-850 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Registered Email:</span>
                  <span className="font-mono text-purple-300 font-medium">{viewingAdminNotif.userEmail}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleDeleteServerNotif(viewingAdminNotif.id)}
                disabled={deletingNotifId === viewingAdminNotif.id}
                className="px-4 py-2 bg-rose-950/50 hover:bg-rose-900/80 border border-rose-800/80 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
              >
                {deletingNotifId === viewingAdminNotif.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 text-rose-400" />
                )}
                <span>Delete from Server</span>
              </button>

              <button
                type="button"
                onClick={() => setViewingAdminNotif(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Users Fetch Confirmation Modal */}
      {allUsersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Load All User Accounts</h3>
                <p className="text-xs text-slate-400">Single-page comprehensive view</p>
              </div>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="flex items-start gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>This action will perform a full scan of all user records in your Firestore database.</span>
              </div>
              <p className="text-slate-400">
                Once loaded, all users are cached in your active session. All sorting, filtering, and searches will execute instantly in-memory with <strong className="text-emerald-400 font-semibold">0 extra Firestore reads</strong>.
              </p>
            </div>

            {allUsersError && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{allUsersError}</span>
              </div>
            )}

            <div className="flex justify-end items-center gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAllUsersModalOpen(false)}
                disabled={isFetchingAllUsers}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={fetchAllUsers}
                disabled={isFetchingAllUsers}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-purple-900/30 disabled:opacity-50"
              >
                {isFetchingAllUsers ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading All Users...</span>
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5" />
                    <span>Load All Users</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-800/60 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-rose-950/50 relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Delete User Account</h3>
                  <p className="text-xs text-rose-400 font-medium">Permanent Database Action</p>
                </div>
              </div>
              <button
                onClick={() => !isDeletingUser && setUserToDelete(null)}
                disabled={isDeletingUser}
                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-3 pb-2.5 border-b border-slate-850">
                <img 
                  src={userToDelete.photoURL || 'https://via.placeholder.com/36'} 
                  alt="" 
                  className="w-9 h-9 rounded-full border border-slate-700 shrink-0" 
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-100 truncate text-sm">{userToDelete.name || 'User'}</div>
                  <div className="text-purple-300 font-mono text-xs truncate">{userToDelete.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-slate-400">
                <div>Plan: <span className="text-slate-200 font-semibold capitalize">{userToDelete.plan || 'Free'}</span></div>
                <div>Credits: <span className="text-slate-200 font-semibold">{userToDelete.unlimited ? '∞' : (userToDelete.credits || 0).toLocaleString()}</span></div>
                <div>Processed: <span className="text-slate-200 font-semibold">{(userToDelete.totalProcessedImages || 0).toLocaleString()}</span></div>
                <div>Joined: <span className="text-slate-200 font-semibold">{userToDelete.joinDate ? new Date(userToDelete.joinDate).toLocaleDateString() : 'N/A'}</span></div>
              </div>
            </div>

            <div className="p-3.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs text-rose-200 flex items-start gap-2.5 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                Are you sure you want to permanently delete this user document from the Firestore database? This action cannot be undone.
              </span>
            </div>

            <div className="flex justify-end items-center gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={isDeletingUser}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-rose-950/50 disabled:opacity-50"
              >
                {isDeletingUser ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting User...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete User</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
    </>
  );
};
