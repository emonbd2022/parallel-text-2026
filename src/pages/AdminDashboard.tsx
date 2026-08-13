import { motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { getDocs, updateDoc, doc, query, orderBy, limit, startAfter, setDoc } from 'firebase/firestore';
import { collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, UserData } from '../contexts/AuthContext';
import { Shield, Search, RefreshCw, Calendar, Activity, AlertTriangle, Bell, MessageSquare } from 'lucide-react';
import { UserActivityModal } from '../components/UserActivityModal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export const AdminDashboard: React.FC = () => {
  const { userData: currentAdmin } = useAuth();
  
  // Cache users in sessionStorage to avoid repeating 20 reads on every page view
  const cachedUsers = (() => {
    try {
      const s = sessionStorage.getItem('adminCachedUsers');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  })();

  const [users, setUsers] = useState<UserData[]>(cachedUsers || []);
  const [loading, setLoading] = useState(cachedUsers ? false : true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  // Date range filter (calculated 100% locally)
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStats, setShowStats] = useState(false);
  
  const [maintenanceMode, setMaintenanceMode] = useState(() => {
    return localStorage.getItem('maintenanceMode') === 'true';
  });
  const [selectedUserForActivity, setSelectedUserForActivity] = useState<UserData | null>(null);
  const [confirmAction, setConfirmAction] = useState<{title: string, message: string, onConfirm: () => void} | null>(null);
  const [notifModal, setNotifModal] = useState<{isOpen: boolean, targetUid?: string, targetName?: string, message: string}>({isOpen: false, message: ''});

  const toggleMaintenance = async () => {
    const newMode = !maintenanceMode;
    setMaintenanceMode(newMode);
    localStorage.setItem('maintenanceMode', String(newMode));
    try {
      await setDoc(doc(db, 'settings', 'general'), { maintenanceMode: newMode }, { merge: true });
    } catch (e) {
      console.warn("Failed to update maintenance settings in Firestore", e);
    }
  };

  const fetchUsers = async (isNextPage = false, forceRefresh = false) => {
    if (!forceRefresh && !isNextPage && users.length > 0) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let q = query(
        collection(db, 'users'), 
        orderBy('totalProcessedImages', 'desc'),
        limit(20)
      );
      
      if (isNextPage && lastVisible) {
        q = query(
          collection(db, 'users'),
          orderBy('totalProcessedImages', 'desc'),
          startAfter(lastVisible),
          limit(20)
        );
      }

      const querySnapshot = await getDocs(q);
      const usersData: UserData[] = [];
      querySnapshot.forEach((d) => {
        usersData.push(d.data() as UserData);
      });

      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }
      
      setHasMore(querySnapshot.docs.length >= 20);

      let updatedList: UserData[];
      if (isNextPage) {
        updatedList = [...users];
        usersData.forEach(u => {
          if (!updatedList.find(x => x.uid === u.uid)) updatedList.push(u);
        });
      } else {
        updatedList = usersData;
      }

      setUsers(updatedList);
      try {
        sessionStorage.setItem('adminCachedUsers', JSON.stringify(updatedList));
      } catch {}
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(false);
  }, []);

  const totalSiteImages = users.reduce((acc, u) => acc + (u.totalProcessedImages || 0), 0);

  const handleUpdateUser = async (uid: string, updates: Partial<UserData>) => {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
      setUsers(prev => {
        const next = prev.map(u => u.uid === uid ? { ...u, ...updates } : u);
        try { sessionStorage.setItem('adminCachedUsers', JSON.stringify(next)); } catch {}
        return next;
      });
    } catch (error) {
      console.error("Error updating user:", error);
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

  const handleSendNotificationAction = () => {
    if (!notifModal.message.trim()) return;
    alert(`Notification recorded locally: "${notifModal.message}"`);
    setNotifModal({isOpen: false, message: ''});
  };

  const handleResetCredits = async (uid: string) => {
    if (confirm('Are you sure you want to reset this user\'s credits to 0?')) {
      await handleUpdateUser(uid, { credits: 0, plan: 'free', unlimited: false });
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.nickname || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    {selectedUserForActivity && <UserActivityModal user={selectedUserForActivity} onClose={() => setSelectedUserForActivity(null)} />}
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex-1 overflow-y-auto p-8 custom-scrollbar"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-emerald-400" />
            Admin Dashboard
          </h1>
          
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => fetchUsers(false, true)}
              className="flex items-center gap-2 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-purple-400" />
              Refresh Data
            </button>

            <label className="flex items-center gap-2 cursor-pointer bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2 shadow-lg">
                <input type="checkbox" checked={maintenanceMode} onChange={toggleMaintenance} className="w-4 h-4 accent-red-500" />
                <span className="text-sm font-bold text-red-400">Maintenance Mode</span>
            </label>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg">
              <div className="text-sm text-slate-400">Date Range Filter</div>
              <div className="flex items-center gap-2 mt-1">
                 <DatePicker
                    selected={startDate}
                    onChange={(date) => setStartDate(date)}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    placeholderText="Start Date"
                    className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-300 w-24 focus:outline-none focus:border-purple-500"
                 />
                 <span className="text-slate-500">-</span>
                 <DatePicker
                    selected={endDate}
                    onChange={(date) => setEndDate(date)}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate}
                    placeholderText="End Date"
                    className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-300 w-24 focus:outline-none focus:border-purple-500"
                 />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
          <div className="flex justify-between items-center mb-6">
            <div className="flex-1 flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800 mr-4">
              <Search className="w-5 h-5 text-slate-500 ml-2" />
              <input 
                type="text" 
                placeholder="Search users by name, email, or nickname..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-200 w-full py-1"
              />
            </div>
            <button 
              onClick={() => setNotifModal({isOpen: true, message: ''})}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Bell className="w-4 h-4" />
              Global Notification
            </button>
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
                  <th className="pb-3 font-semibold">Processed</th>
                  <th className="pb-3 font-semibold">Avg/Day</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr><td colSpan={9} className="py-8 text-center text-slate-500">Loading users...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-slate-500">No users found.</td></tr>
                ) : (
                  filteredUsers.map((user, index) => {
                        const rank = index + 1;
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
                              onChange={(e) => setUsers(prev => prev.map(u => u.uid === user.uid ? {...u, nickname: e.target.value} : u))}
                              onBlur={(e) => handleUpdateUser(user.uid, { nickname: e.target.value })}
                              className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-purple-500"
                           />
                        </td>
                        
                        <td className="py-4 text-slate-300 font-mono">
                            <input 
                              type="number"
                              value={user.credits}
                              onChange={(e) => setUsers(prev => prev.map(u => u.uid === user.uid ? {...u, credits: parseInt(e.target.value) || 0} : u))}
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
                        
                        <td className="py-4">
                            <div className="flex items-center gap-2 justify-end">
                              <button onClick={() => setSelectedUserForActivity(user)} className="p-1.5 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors" title="View User Analytics">
                                 <Activity className="w-4 h-4" />
                              </button>
                              <button onClick={() => setNotifModal({isOpen: true, targetUid: user.uid, targetName: user.name, message: ''})} className="p-1.5 bg-purple-500/10 text-purple-400 rounded hover:bg-purple-500/20 transition-colors" title="Send Notification">
                                 <MessageSquare className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleResetCredits(user.uid)} className="p-1.5 bg-orange-500/10 text-orange-400 rounded hover:bg-orange-500/20 transition-colors" title="Reset Credits & Plan">
                                 <RefreshCw className="w-4 h-4" />
                              </button>
                            </div>
                        </td>
                      </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
          {hasMore && !searchTerm && (
            <div className="flex justify-center mt-6">
                <button 
                  onClick={() => fetchUsers(true)}
                  disabled={loading}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm text-slate-300 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Loading...' : 'Load More Users'}
                </button>
            </div>
          )}

        </div>
      </div>

      {showStats && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-3">
               <Calendar className="w-6 h-6 text-purple-400" />
               Date Range Statistics
            </h2>
            <div className="space-y-4 mb-8">
               <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                  <span className="text-slate-400">Total Users</span>
                  <span className="text-xl font-bold text-white">{filteredUsers.length}</span>
               </div>
               <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                  <span className="text-slate-400">Total Images Processed</span>
                  <span className="text-xl font-bold text-emerald-400">{totalSiteImages}</span>
               </div>
            </div>
            <button onClick={() => setShowStats(false)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-white transition-colors">
               Close
            </button>
          </motion.div>
        </div>
      )}

      {notifModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
              <h3 className="text-xl font-bold text-white mb-4">Send Notification {notifModal.targetName ? `to ${notifModal.targetName}` : 'to All Users'}</h3>
              <textarea 
                 className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 outline-none focus:border-purple-500 mb-4 resize-none"
                 placeholder="Enter message..."
                 value={notifModal.message}
                 onChange={e => setNotifModal(prev => ({...prev, message: e.target.value}))}
              />
              <div className="flex gap-3 justify-end">
                 <button onClick={() => setNotifModal({isOpen: false, message: ''})} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">Cancel</button>
                 <button onClick={handleSendNotificationAction} disabled={!notifModal.message.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 font-bold flex items-center gap-2">
                    Send
                 </button>
              </div>
           </div>
        </div>
      )}
      
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                <h3 className="text-xl font-bold text-white">{confirmAction.title}</h3>
              </div>
              <p className="text-slate-300 mb-6">{confirmAction.message}</p>
              <div className="flex gap-3 justify-end">
                 <button onClick={() => setConfirmAction(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">Cancel</button>
                 <button onClick={confirmAction.onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 font-bold">
                    Confirm
                 </button>
              </div>
           </div>
        </div>
      )}
    </motion.div>
    </>
  );
};
