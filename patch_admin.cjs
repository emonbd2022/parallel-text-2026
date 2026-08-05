const fs = require('fs');

const content = `import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, UserData } from '../contexts/AuthContext';
import { Shield, Search, RefreshCw, Calendar } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { userData: currentAdmin } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalSiteImages, setTotalSiteImages] = useState(0);

  // Date range filter
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRangeImages, setDateRangeImages] = useState(0);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserData[] = [];
      let total = 0;
      querySnapshot.forEach((d) => {
        const data = d.data() as UserData;
        usersData.push(data);
        total += (data.totalProcessedImages || 0);
      });
      setUsers(usersData);
      setTotalSiteImages(total);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Simplified calculation for processed in date range
  useEffect(() => {
    // In a real app we'd track processing logs with dates in Firestore.
    // For now we'll just mock the visual or assume totalProcessedImages if no logs.
    // Since we don't store per-date processed count globally, this is just a placeholder.
    if (startDate && endDate) {
       setDateRangeImages(0); // Needs backend aggregation
    } else {
       setDateRangeImages(totalSiteImages);
    }
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

  const handleResetCredits = async (uid: string) => {
    if (confirm('Are you sure you want to reset this user\\'s credits to 0?')) {
        await handleUpdateUser(uid, { credits: 0, plan: 'free', unlimited: false });
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-emerald-400" />
            Admin Dashboard
          </h1>
          
          <div className="flex gap-4">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg">
              <div className="text-sm text-slate-400">Total Site Images Processed</div>
              <div className="text-2xl font-bold text-white">{totalSiteImages.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg">
              <div className="text-sm text-slate-400">Date Range Stats</div>
              <div className="flex items-center gap-2 mt-1">
                 <input type="date" className="bg-slate-950 border border-slate-700 text-xs rounded px-1 text-slate-300" value={startDate} onChange={e => setStartDate(e.target.value)} />
                 <span className="text-slate-500">-</span>
                 <input type="date" className="bg-slate-950 border border-slate-700 text-xs rounded px-1 text-slate-300" value={endDate} onChange={e => setEndDate(e.target.value)} />
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
                  <th className="pb-3 font-semibold w-1/4">User</th>
                  <th className="pb-3 font-semibold">Nickname</th>
                  <th className="pb-3 font-semibold">Credits</th>
                  <th className="pb-3 font-semibold">Plan & Validity</th>
                  <th className="pb-3 font-semibold">Processed</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-500">Loading users...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-500">No users found.</td></tr>
                ) : (
                  filteredUsers.map(user => (
                      <tr key={user.uid} className="hover:bg-slate-800/30 transition-colors">
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
                        
                        <td className="py-4 text-slate-400 font-mono">
                          {user.totalProcessedImages || 0}
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
`;
fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
