import { motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getAggregateFromServer, sum, where, deleteDoc, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, UserData } from '../contexts/AuthContext';
import { Shield, Search, RefreshCw, Calendar, Trash2, Activity } from 'lucide-react';
import { UserActivityModal } from '../components/UserActivityModal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

export const AdminDashboard: React.FC = () => {
  const { userData: currentAdmin } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalSiteImages, setTotalSiteImages] = useState(0);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // Date range filter
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [dateRangeImages, setDateRangeImages] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [isDeletingCsvs, setIsDeletingCsvs] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [selectedUserForActivity, setSelectedUserForActivity] = useState<UserData | null>(null);
  const [showGlobalNotif, setShowGlobalNotif] = useState(false);
  const [globalNotifMsg, setGlobalNotifMsg] = useState("");
  const [isSendingGlobal, setIsSendingGlobal] = useState(false);
  
  useEffect(() => {
    const fetchMaintenance = async () => {
      const docRef = doc(db, 'settings', 'general');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setMaintenanceMode(snap.data().maintenanceMode || false);
      }
    };
    fetchMaintenance();
  }, []);
  
  const toggleMaintenance = async () => {
    const newMode = !maintenanceMode;
    setMaintenanceMode(newMode);
    await setDoc(doc(db, 'settings', 'general'), { maintenanceMode: newMode }, { merge: true });
    alert(`Maintenance mode is now ${newMode ? 'ON' : 'OFF'}`);
  };

  const handleDeleteOldCsvs = async () => {
    if (!confirm('Are you sure you want to delete CSV exports older than 30 days?')) return;
    setIsDeletingCsvs(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const q = query(collection(db, 'csv_exports'), where('createdAt', '<', thirtyDaysAgo));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      alert(`Deleted ${deletePromises.length} old CSV exports.`);
    } catch (e) {
      console.error(e);
      alert('Failed to delete old CSV exports.');
    } finally {
      setIsDeletingCsvs(false);
    }
  };

  const handleDeleteAllCsvs = async () => {
    if (!confirm('WARNING: Are you sure you want to delete ALL CSV exports? This cannot be undone.')) return;
    setIsDeletingCsvs(true);
    try {
      const snapshot = await getDocs(collection(db, 'csv_exports'));
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      alert(`Deleted all ${deletePromises.length} CSV exports.`);
    } catch (e) {
      console.error(e);
      alert('Failed to delete all CSV exports.');
    } finally {
      setIsDeletingCsvs(false);
    }
  };

  
  const fetchTotalAggregate = async () => {
    try {
      const coll = collection(db, 'users');
      const snapshot = await getAggregateFromServer(coll, {
        totalImages: sum('totalProcessedImages')
      });
      setTotalSiteImages(snapshot.data().totalImages);
    } catch (e) {
      console.warn("Aggregate query failed", e);
    }
  };

  const fetchUsers = async (isNextPage = false) => {
    try {
      setLoading(true);
      let q = query(
        collection(db, 'users'), 
        orderBy('totalProcessedImages', 'desc'),
        limit(10)
      );
      
      if (isNextPage && lastVisible) {
        q = query(
          collection(db, 'users'),
          orderBy('totalProcessedImages', 'desc'),
          startAfter(lastVisible),
          limit(10)
        );
      } else if (!isNextPage) {
        setUsers([]);
        setPage(0);
      }

      const querySnapshot = await getDocs(q);
      const usersData: UserData[] = [];
      querySnapshot.forEach((d) => {
        usersData.push(d.data() as UserData);
      });

      if (querySnapshot.docs.length > 0) {
          setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }
      
      setHasMore(querySnapshot.docs.length >= 10);

      if (isNextPage) {
          setUsers(prev => {
              const newUsers = [...prev];
              usersData.forEach(u => {
                  if (!newUsers.find(x => x.uid === u.uid)) newUsers.push(u);
              });
              return newUsers;
          });
          setPage(p => p + 1);
      } else {
          setUsers(usersData);
          setPage(1);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTotalAggregate();
    fetchUsers(false);

    // Auto-delete CSVs older than 30 days silently on load
    const autoCleanup = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const q = query(collection(db, 'csv_exports'), where('createdAt', '<', thirtyDaysAgo));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);
            console.log(`Auto-cleaned ${deletePromises.length} old CSVs`);
        }
      } catch (e) {
        console.error("Auto-cleanup failed:", e);
      }
    };
    autoCleanup();
  }, []);


  useEffect(() => {
    const fetchDateRangeActivity = async () => {
        if (startDate && endDate) {
            try {
                // Ensure endDate includes the full day
                const endOfDay = new Date(endDate);
                endOfDay.setHours(23, 59, 59, 999);
                
                const q = query(
                    collection(db, 'activity_logs'),
                    where('timestamp', '>=', startDate),
                    where('timestamp', '<=', endOfDay)
                );
                const snapshot = await getAggregateFromServer(q, {
                    imagesProcessed: sum('imagesProcessed')
                });
                setDateRangeImages(snapshot.data().imagesProcessed || 0);
            } catch (error) {
                console.error("Error fetching date range activity:", error);
                setDateRangeImages(0);
            }
        } else {
            setDateRangeImages(totalSiteImages);
        }
    };
    fetchDateRangeActivity();
  }, [startDate, endDate, totalSiteImages]);

  const handleUpdateUser = async (uid: string, updates: Partial<UserData>) => {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updates } : u));
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user");
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

  
  const handleSendGlobalNotification = async () => {
      if (!globalNotifMsg.trim()) return;
      setIsSendingGlobal(true);
      try {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          let count = 0;
          for (const docSnap of allUsersSnap.docs) {
              await addDoc(collection(db, 'notifications'), {
                  targetUid: docSnap.id,
                  type: 'admin_msg',
                  message: globalNotifMsg,
                  read: false,
                  createdAt: serverTimestamp()
              });
              count++;
          }
          alert(`Sent to ${count} users`);
          setShowGlobalNotif(false);
          setGlobalNotifMsg("");
      } catch (e) {
          console.error(e);
          alert("Failed to send global notification");
      } finally {
          setIsSendingGlobal(false);
      }
  };

const handleSendNotification = async (uid: string) => {
      const msg = prompt('Enter notification message for this user:');
      if (!msg) return;
      try {
          await addDoc(collection(db, 'notifications'), {
              targetUid: uid,
              type: 'admin_msg',
              message: msg,
              read: false,
              createdAt: serverTimestamp()
          });
          alert('Notification sent!');
      } catch (e) {
          console.error(e);
          alert('Failed to send notification');
      }
  };

  const handleResetCredits = async (uid: string) => {
    if (confirm('Are you sure you want to reset this user\'s credits to 0?')) {
        await handleUpdateUser(uid, { credits: 0, plan: 'free', unlimited: false });
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.nickname.toLowerCase().includes(searchTerm.toLowerCase())
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
            <label className="flex items-center gap-2 cursor-pointer bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2 shadow-lg">
                <input type="checkbox" checked={maintenanceMode} onChange={toggleMaintenance} className="w-4 h-4 accent-red-500" />
                <span className="text-sm font-bold text-red-400">Maintenance Mode</span>
            </label>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg flex flex-col gap-2">
              <div className="text-sm text-slate-400">Notifications</div>
              <button onClick={() => setShowGlobalNotif(true)} className="px-3 py-1 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded text-xs font-bold transition-colors">
                 Send Global Message
              </button>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg">
              <div className="text-sm text-slate-400">Total Site Images Processed</div>
              <div className="text-2xl font-bold text-white">{totalSiteImages.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg flex flex-col gap-2">
              <div className="text-sm text-slate-400">Storage Management</div>
              <div className="flex items-center gap-2">
                 <button disabled={isDeletingCsvs} onClick={handleDeleteOldCsvs} className="px-3 py-1 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded text-xs font-bold transition-colors">
                    Delete &gt; 30 Days
                 </button>
                 <button disabled={isDeletingCsvs} onClick={handleDeleteAllCsvs} className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs font-bold transition-colors flex items-center gap-1">
                    <Trash2 className="w-3 h-3"/> All CSVs
                 </button>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg">
              <div className="text-sm text-slate-400">Date Range Stats</div>
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
          <div className="flex items-center gap-3 mb-6 bg-slate-950 p-2 rounded-xl border border-slate-800">
            <Search className="w-5 h-5 text-slate-500 ml-2" />
            <input 
              type="text" 
              placeholder="Search users by name, email, or nickname..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-slate-200 w-full py-1"
            />
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
                              <div className="font-medium text-slate-200">{user.name}</div>
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-4 text-slate-300">
                           <input 
                              type="text"
                              value={user.nickname}
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
                        
                        <td className="py-4 text-right">
                            <button onClick={() => handleResetCredits(user.uid)} className="p-1.5 bg-orange-500/10 text-orange-400 rounded hover:bg-orange-500/20 transition-colors" title="Reset Credits & Plan">
                               <RefreshCw className="w-4 h-4" />
                            </button>
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
                  <span className="text-slate-400">Total Images (All Time)</span>
                  <span className="text-xl font-bold text-white">{totalSiteImages}</span>
               </div>
               <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center">
                  <span className="text-slate-400">Images in Date Range</span>
                  <span className="text-xl font-bold text-emerald-400">{dateRangeImages}</span>
               </div>
            </div>
            <button onClick={() => setShowStats(false)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-white transition-colors">
               Close
            </button>
          </motion.div>
        </div>
      )}

        {showGlobalNotif && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
             <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
                <h3 className="text-xl font-bold text-white mb-4">Send Global Notification</h3>
                <textarea 
                   className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 outline-none focus:border-purple-500 mb-4 resize-none"
                   placeholder="Enter message for ALL users..."
                   value={globalNotifMsg}
                   onChange={e => setGlobalNotifMsg(e.target.value)}
                />
                <div className="flex gap-3 justify-end">
                   <button onClick={() => setShowGlobalNotif(false)} disabled={isSendingGlobal} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">Cancel</button>
                   <button onClick={handleSendGlobalNotification} disabled={isSendingGlobal || !globalNotifMsg.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 font-bold flex items-center gap-2">
                      {isSendingGlobal ? 'Sending...' : 'Send to All Users'}
                   </button>
                </div>
             </div>
          </div>
        )}

    </motion.div>
    </>
  );
};
