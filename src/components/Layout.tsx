import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../lib/firebase';
import { Menu, LogOut, Home, User, CreditCard, Shield, X, ChevronLeft, Layers, Wrench, Bell, Upload } from 'lucide-react';
import { useEffect } from 'react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData, loading, maintenanceMode, notifications, setNotifications } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  


  const handleUploadClick = () => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        document.getElementById('fileInput')?.click();
      }, 150);
    } else {
      document.getElementById('fileInput')?.click();
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const handleMarkAsRead = async (id: string) => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      const readIds = JSON.parse(localStorage.getItem('readNotifs') || '[]');
      if (!readIds.includes(id)) {
          readIds.push(id);
          localStorage.setItem('readNotifs', JSON.stringify(readIds));
      }
  };
  const handleOpenNotifications = () => {
      const willShow = !showNotifications;
      setShowNotifications(willShow);
      if (willShow) {
          const readIds = JSON.parse(localStorage.getItem('readNotifs') || '[]');
          setNotifications(prev => {
              const updated = prev.map(n => ({ ...n, read: true }));
              updated.forEach(n => {
                  if (!readIds.includes(n.id)) readIds.push(n.id);
              });
              localStorage.setItem('readNotifs', JSON.stringify(readIds));
              return updated;
          });
      }
  };

  const handleLogout = async () => {
    // Preserve user accounts, images, metadata, and configurations in cache
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
      <header className="h-16 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-[100] relative">
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
          <button
            onClick={handleUploadClick}
            className="ml-1 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-purple-900/30 flex items-center gap-1.5 border border-purple-400/30 active:scale-95 shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
          <div className="w-px h-6 bg-slate-800 mx-2" />
          {userData ? (
            <>
              <div className="relative cursor-pointer mr-2 flex items-center" onClick={handleOpenNotifications}>
                 <Bell className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                 {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{unreadCount}</span>}
              </div>
              {showNotifications && (
                 <div className="absolute top-16 right-6 sm:right-20 w-80 bg-slate-900/95 backdrop-blur-xl border border-purple-500/20 rounded-xl shadow-[0_10px_40px_-10px_rgba(168,85,247,0.3)] z-[9999] overflow-hidden transform origin-top-right animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-800/80 flex justify-between items-center bg-slate-950/50">
                       <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-emerald-400 tracking-wide">Notifications</span>
                       <button onClick={() => setShowNotifications(false)} className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                       {notifications.length === 0 ? (
                          <div className="p-8 flex flex-col items-center justify-center gap-2 text-center text-slate-500 font-medium">
                             <Bell className="w-8 h-8 text-slate-700 mb-1" />
                             You're all caught up!
                          </div>
                       ) : (
                          notifications.map(n => (
                             <div key={n.id} onClick={() => handleMarkAsRead(n.id)} className={`p-4 border-b border-slate-800/50 text-sm cursor-pointer transition-all duration-300 ${!n.read ? 'bg-gradient-to-r from-purple-900/40 to-emerald-900/10 hover:from-purple-900/50 hover:to-emerald-900/20 shadow-[inset_3px_0_0_0_#a855f7]' : 'opacity-70 hover:bg-slate-800/50'}`}>
                                <div className="flex items-start justify-between gap-3">
                                   <span className={`font-medium leading-relaxed ${!n.read ? 'text-purple-50 font-semibold drop-shadow-sm tracking-wide' : 'text-slate-400'}`}>{n.message}</span>
                                   {!n.read && <div className="w-2.5 h-2.5 mt-1 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,1)] shrink-0 animate-pulse"></div>}
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
          <button
            onClick={() => { handleUploadClick(); setMobileMenu(false); }}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 mb-2 shadow-lg active:scale-95 transition-all"
          >
            <Upload className="w-5 h-5" />
            <span>Upload Images</span>
          </button>
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
