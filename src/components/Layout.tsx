import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, AppNotification } from '../contexts/AuthContext';
import { logout } from '../lib/firebase';
import { Menu, LogOut, Home, User, CreditCard, Shield, X, ChevronLeft, Layers, Wrench, Bell, Upload, UserPlus } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData, loading, maintenanceMode, notifications, deleteNotification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [viewingNotification, setViewingNotification] = useState<AppNotification | null>(null);

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

  const handleViewNotification = async (notification: AppNotification) => {
    setViewingNotification(notification);
    // Explicitly delete from Firestore and local cache upon viewing
    await deleteNotification(notification.id);
  };

  const handleToggleNotifications = () => {
    // Only toggles dropdown visibility. Does NOT delete notifications unless viewed.
    setShowNotifications(prev => !prev);
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
        ) : (
          <nav className="hidden md:flex items-center gap-2">
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
                <div className="relative cursor-pointer mr-2 flex items-center" onClick={handleToggleNotifications}>
                  <Bell className="w-5 h-5 text-slate-400 hover:text-white transition-colors" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {notifications.length}
                    </span>
                  )}
                </div>
                {showNotifications && (
                  <div className="absolute top-16 right-6 sm:right-20 w-84 bg-slate-900/95 backdrop-blur-xl border border-purple-500/20 rounded-xl shadow-[0_10px_40px_-10px_rgba(168,85,247,0.3)] z-[9999] overflow-hidden transform origin-top-right animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-slate-800/80 flex justify-between items-center bg-slate-950/50">
                      <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-emerald-400 tracking-wide text-sm">
                        Notifications {notifications.length > 0 ? `(${notifications.length})` : ''}
                      </span>
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
                          <div 
                            key={n.id} 
                            onClick={() => handleViewNotification(n)} 
                            className="p-4 border-b border-slate-800/50 text-sm cursor-pointer transition-all duration-300 bg-gradient-to-r from-purple-900/40 to-emerald-900/10 hover:from-purple-900/60 hover:to-emerald-900/30 shadow-[inset_3px_0_0_0_#a855f7] group"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400">
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>New User Signup</span>
                                  </div>
                                  <span className="text-[10px] text-purple-300 font-medium px-1.5 py-0.5 rounded bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
                                    View
                                  </span>
                                </div>
                                <div className="whitespace-pre-line text-xs leading-relaxed text-purple-50 font-medium pt-0.5">
                                  {n.message}
                                </div>
                                {n.createdAt && (
                                  <div className="text-[10px] text-slate-400 pt-1">
                                    {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                              </div>
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
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white transition-colors" title="Sign Out">
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white rounded-lg font-medium text-sm transition-all shadow-md shadow-purple-900/20"
              >
                Sign In
              </button>
            )}
          </nav>
        )}

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          {userData && (
            <div className="relative cursor-pointer mr-1 flex items-center" onClick={handleToggleNotifications}>
              <Bell className="w-5 h-5 text-slate-400 hover:text-white" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </div>
          )}
          <button
            onClick={() => setMobileMenu(!mobileMenu)}
            className="p-2 text-slate-400 hover:text-white focus:outline-none"
          >
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenu && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-6 space-y-3 z-50 animate-in slide-in-from-top duration-200">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setMobileMenu(false); }}
              className={`w-full px-4 py-3 rounded-xl font-medium text-base transition-colors flex items-center gap-3 ${location.pathname === item.path ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </button>
          ))}
          <button
            onClick={() => { setMobileMenu(false); handleUploadClick(); }}
            className="w-full px-4 py-3 rounded-xl font-medium text-base transition-colors flex items-center gap-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white"
          >
            <Upload className="w-5 h-5" />
            Upload
          </button>
          {userData ? (
            <button
              onClick={() => { handleLogout(); setMobileMenu(false); }}
              className="w-full px-4 py-3 rounded-xl font-medium text-base transition-colors flex items-center gap-3 text-red-400 hover:bg-slate-800/50"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => { navigate('/login'); setMobileMenu(false); }}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-emerald-600 rounded-xl font-bold text-white text-center shadow-lg shadow-purple-900/30"
            >
              Sign In
            </button>
          )}
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>

      {/* Viewed Notification Detail Modal */}
      {viewingNotification && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 max-w-md w-full shadow-[0_20px_60px_-15px_rgba(168,85,247,0.3)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <UserPlus className="w-5 h-5" />
                <span>New User Registration</span>
              </div>
              <button
                onClick={() => setViewingNotification(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800/80 space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Name:</span>
                <span className="text-white font-medium">{viewingNotification.userName || 'User'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Email:</span>
                <span className="text-purple-300 font-mono text-xs">{viewingNotification.userEmail || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Registered:</span>
                <span className="text-slate-300 text-xs">{new Date(viewingNotification.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Starting Credits:</span>
                <span className="text-emerald-400 font-medium">100 Credits</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 text-center">
              This notification has been viewed and deleted from Firestore.
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={() => setViewingNotification(null)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-purple-900/30"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
