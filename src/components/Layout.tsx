import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../lib/firebase';
import { Menu, LogOut, Home, User, CreditCard, Shield, X, ChevronLeft, Layers, Wrench, Bell } from 'lucide-react';
import { doc, getDoc, onSnapshot, collection, query, where, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEffect } from 'react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  useEffect(() => {
    if (!userData) return;
    let unsub = () => {};
    try {
        const q = query(collection(db, 'notifications'), where('targetUid', 'in', [userData.uid, userData.role === 'admin' ? 'admin' : 'none']), orderBy('createdAt', 'desc'));
        unsub = onSnapshot(q, (snapshot) => {
            const notifs: any[] = [];
            snapshot.forEach(d => notifs.push({ id: d.id, ...d.data() }));
            setNotifications(notifs);
        }, (err) => {
           console.warn("Could not load notifications:", err);
        });
    } catch (e) {
        console.warn("Error setting up notifications listener:", e);
    }
    return () => unsub();
  }, [userData]);
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  const handleMarkAsRead = async (id: string) => {
      await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  
  useEffect(() => {
    let unsub = () => {};
    try {
        unsub = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
          if (doc.exists()) {
            setMaintenanceMode(doc.data().maintenanceMode || false);
          }
        }, (err) => {
           console.warn("Could not load settings:", err);
        });
    } catch (e) {
        console.warn("Error setting up settings listener:", e);
    }
    return () => unsub();
  }, []);


  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: userData?.plan && userData.plan !== 'free' ? 'Upgrade' : 'Pricing', path: '/pricing', icon: CreditCard },
  ];

  if (userData) {
    navItems.splice(1, 0, { name: 'Dashboard', path: '/dashboard', icon: User });
  }

  if (userData?.role === 'admin') {
    navItems.push({ name: 'Admin', path: '/admin', icon: Shield });
  }

  if (maintenanceMode && userData?.role !== 'admin' && location.pathname !== '/login') {
      return (
          <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200 selection:bg-purple-500/30 font-sans p-6 text-center">
             <Wrench className="w-20 h-20 text-red-500 mb-6" />
             <h1 className="text-4xl font-bold text-white mb-4">Site Under Maintenance</h1>
             <p className="text-slate-400 max-w-lg text-lg">We are currently performing scheduled maintenance. Please check back soon.</p>
             <button onClick={handleLogout} className="mt-8 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-white transition-colors">Sign Out</button>
          </div>
      );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden text-slate-200 selection:bg-purple-500/30 font-sans">
      <header className="h-16 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          {location.pathname !== '/' ? (
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-semibold rounded-lg hover:bg-slate-800">
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>
          ) : null}
          <button onClick={() => navigate('/')} className="flex items-center gap-3 hover:opacity-80 transition-opacity outline-none group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-emerald-500 flex items-center justify-center text-white shadow-lg group-hover:animate-pulse-glow">
              <Layers className="w-5 h-5 group-hover:animate-spin-slow" />
            </div>
            <span className="font-bold text-lg hidden sm:block bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-emerald-400">Parallel Text</span>
          </button>
        </div>
        
        {/* Desktop Nav */}
        {loading ? (
        <nav className="hidden md:flex items-center gap-2">
          <div className="w-20 h-8 bg-slate-800 rounded-lg animate-pulse" />
          <div className="w-px h-6 bg-slate-800 mx-2" />
          <div className="w-24 h-8 bg-slate-800 rounded-lg animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse ml-2" />
        </nav>
) : (<nav className="hidden md:flex items-center gap-2">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${location.pathname === item.path ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </button>
          ))}
          <div className="w-px h-6 bg-slate-800 mx-2" />
          {userData ? (
            <>
              <div className="relative cursor-pointer mr-2 flex items-center" onClick={() => setShowNotifications(!showNotifications)}>
                 <Bell className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                 {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{unreadCount}</span>}
              </div>
              {showNotifications && (
                 <div className="absolute top-16 right-20 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-slate-700 font-bold flex justify-between items-center">
                       Notifications
                       <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                       {notifications.length === 0 ? (
                          <div className="p-4 text-center text-sm text-slate-500">No notifications</div>
                       ) : (
                          notifications.map(n => (
                             <div key={n.id} onClick={() => handleMarkAsRead(n.id)} className={`p-3 border-b border-slate-700 text-sm cursor-pointer hover:bg-slate-700/50 transition-colors ${!n.read ? 'bg-slate-700/20' : 'opacity-60'}`}>
                                <div className="flex items-center justify-between gap-2">
                                   <span className={`font-medium ${!n.read ? 'text-white' : 'text-slate-400'}`}>{n.message}</span>
                                   {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>}
                                </div>
                             </div>
                          ))
                       )}
                    </div>
                 </div>
              )}
              <div className="flex items-center gap-3 mr-4">
                <span className="text-sm text-slate-400">{userData.credits === -1 || userData.unlimited ? '∞ Credits' : `${userData.credits || 0} Credits`}</span>
                <div className="relative">
                  <div className="relative group cursor-pointer" onClick={() => navigate('/dashboard')}>
                    <img src={userData.photoURL || 'https://via.placeholder.com/32'} alt="User" className="w-8 h-8 rounded-full border border-slate-700" />
                    {(userData.plan && userData.plan !== 'free') && (
                       <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shadow-sm border border-white/10 whitespace-nowrap z-10 pointer-events-none">
                         {userData.plan}
                       </div>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 transition-colors" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button onClick={() => navigate('/login')} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-bold transition-colors">
              Sign In
            </button>
          )}
        </nav>)}

        {/* Mobile Nav Toggle */}
        <button className="md:hidden p-2 text-slate-400 hover:text-white" onClick={() => setMobileMenu(!mobileMenu)}>
          {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Mobile Menu */}
      {mobileMenu && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-slate-900 border-b border-slate-800 z-50 p-4 flex flex-col gap-2 shadow-2xl">
          {userData ? (
            <div className="flex items-center gap-3 mb-4 p-2">
              <div className="relative cursor-pointer" onClick={() => { navigate('/dashboard'); setMobileMenu(false); }}>
                 <img src={userData.photoURL || 'https://via.placeholder.com/32'} alt="User" className="w-10 h-10 rounded-full border border-slate-700" />
                 {(userData.plan && userData.plan !== 'free') && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shadow-sm border border-white/10 whitespace-nowrap z-10 pointer-events-none">
                      {userData.plan}
                    </div>
                 )}
               </div>
              <div className="ml-2">
                <div className="font-bold">{userData.nickname}</div>
                <div className="text-sm text-slate-400">{userData.credits === -1 || userData.unlimited ? '∞ Credits' : `${userData.credits || 0} Credits`}</div>
              </div>
            </div>
          ) : (
             <div className="mb-4 p-2">
                <button onClick={() => { navigate('/login'); setMobileMenu(false); }} className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold">Sign In</button>
             </div>
          )}
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setMobileMenu(false); }}
              className={`px-4 py-3 rounded-lg font-medium text-left transition-colors flex items-center gap-3 ${location.pathname === item.path ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </button>
          ))}
          {userData && (
            <button onClick={handleLogout} className="px-4 py-3 rounded-lg font-medium text-left text-red-400 flex items-center gap-3 mt-2 border-t border-slate-800 pt-4">
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
};
