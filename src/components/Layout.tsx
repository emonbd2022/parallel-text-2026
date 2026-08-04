import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logout } from '../lib/firebase';
import { Menu, LogOut, Home, User, CreditCard, Shield, X } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'App', path: '/', icon: Home },
    { name: 'Pricing', path: '/pricing', icon: CreditCard },
  ];

  if (userData) {
    navItems.splice(1, 0, { name: 'Dashboard', path: '/dashboard', icon: User });
  }

  if (userData?.role === 'admin') {
    navItems.push({ name: 'Admin', path: '/admin', icon: Shield });
  }

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden text-slate-200 selection:bg-purple-500/30 font-sans">
      <header className="h-16 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-emerald-500 flex items-center justify-center font-bold text-white shadow-lg">PT</div>
          <span className="font-bold text-lg hidden sm:block">Parallel Text</span>
        </div>
        
        {/* Desktop Nav */}
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
          <div className="w-px h-6 bg-slate-800 mx-2" />
          {userData ? (
            <>
              <div className="flex items-center gap-3 mr-4">
                <span className="text-sm text-slate-400">{userData.credits === -1 || userData.unlimited ? '∞ Credits' : `${userData.credits || 0} Credits`}</span>
                <img src={userData.photoURL || 'https://via.placeholder.com/32'} alt="User" className="w-8 h-8 rounded-full border border-slate-700" />
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
        </nav>

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
              <img src={userData.photoURL || 'https://via.placeholder.com/32'} alt="User" className="w-10 h-10 rounded-full border border-slate-700" />
              <div>
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
