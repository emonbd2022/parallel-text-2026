import React, { useEffect, useState } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, UserData } from '../contexts/AuthContext';
import { Shield, Search, Edit2, Ban, CheckCircle, Save, X, RefreshCw } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { userData: currentAdmin } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ credits: 0, unlimited: false, nickname: '', blocked: false });
  const [totalSiteImages, setTotalSiteImages] = useState(0);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserData[] = [];
      let total = 0;
      querySnapshot.forEach((doc) => {
        const data = doc.data() as UserData;
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

  const handleEditClick = (user: UserData) => {
    setEditingUser(user.uid);
    setEditForm({
      credits: user.credits,
      unlimited: user.unlimited,
      nickname: user.nickname,
      blocked: user.blocked || false,
    });
  };

  const handleSave = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        credits: editForm.credits,
        unlimited: editForm.unlimited,
        nickname: editForm.nickname,
        blocked: editForm.blocked,
      });
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user");
    }
  };

  const handleResetCredits = async (uid: string) => {
    if (confirm('Are you sure you want to reset this user\'s credits to 0?')) {
      try {
        await updateDoc(doc(db, 'users', uid), { credits: 0 });
        fetchUsers();
      } catch (error) {
        console.error("Error resetting credits:", error);
      }
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
          
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-6 py-3 shadow-lg">
            <div className="text-sm text-slate-400">Total Site Images Processed</div>
            <div className="text-2xl font-bold text-white">{totalSiteImages.toLocaleString()}</div>
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
                  <th className="pb-3 font-semibold">Plan</th>
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
                  filteredUsers.map(user => {
                    const isEditing = editingUser === user.uid;
                    return (
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
                          {isEditing ? (
                            <input 
                              type="text" 
                              value={editForm.nickname}
                              onChange={(e) => setEditForm({...editForm, nickname: e.target.value})}
                              className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-purple-500"
                            />
                          ) : (
                            user.nickname
                          )}
                        </td>
                        <td className="py-4 text-slate-300 font-mono">
                          {isEditing ? (
                            <input 
                              type="number" 
                              value={editForm.credits}
                              onChange={(e) => setEditForm({...editForm, credits: parseInt(e.target.value) || 0})}
                              className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-purple-500"
                            />
                          ) : (
                            user.credits
                          )}
                        </td>
                        <td className="py-4">
                          {isEditing ? (
                            <select
                              value={editForm.unlimited ? 'pro' : (editForm.credits >= 500 ? 'basic' : 'free')}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'pro') {
                                  setEditForm(prev => ({ ...prev, unlimited: true }));
                                } else if (val === 'basic') {
                                  setEditForm(prev => ({ ...prev, unlimited: false, credits: Math.max(prev.credits, 500) }));
                                } else {
                                  setEditForm(prev => ({ ...prev, unlimited: false }));
                                }
                              }}
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm outline-none text-slate-200"
                            >
                              <option value="free">Free</option>
                              <option value="basic">Basic</option>
                              <option value="pro">Pro (Unlimited)</option>
                            </select>
                          ) : (
                            <div className="flex items-center">
                              {user.unlimited ? (
                                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs font-semibold">Pro</span>
                              ) : user.credits >= 500 ? (
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold">Basic</span>
                              ) : (
                                <span className="px-2 py-1 bg-slate-700/50 text-slate-400 rounded text-xs font-semibold">Free</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-4 text-slate-400 font-mono">
                          {user.totalProcessedImages || 0}
                        </td>
                        <td className="py-4">
                          {isEditing ? (
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={editForm.blocked}
                                onChange={(e) => setEditForm({...editForm, blocked: e.target.checked})}
                                disabled={user.uid === currentAdmin?.uid}
                                className="w-4 h-4 accent-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <span className="text-sm text-slate-400">Blocked</span>
                            </label>
                          ) : (
                            user.blocked ? (
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-semibold">Blocked</span>
                            ) : (
                              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-semibold">Active</span>
                            )
                          )}
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={() => handleSave(user.uid)} className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors" title="Save">
                                  <Save className="w-4 h-4" />
                                </button>
                                <button onClick={() => setEditingUser(null)} className="p-1.5 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors" title="Cancel">
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => handleEditClick(user)} className="p-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors" title="Edit User">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleResetCredits(user.uid)} className="p-1.5 bg-orange-500/10 text-orange-400 rounded hover:bg-orange-500/20 transition-colors" title="Reset Credits to 0">
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
