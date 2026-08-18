import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import App from './App.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { Pricing } from './pages/Pricing';
import { Tutorial } from './pages/Tutorial';
import { Layout } from './components/Layout';
import { Cat } from 'lucide-react';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({ immediate: true, onNeedRefresh() { updateSW(true); } });

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, userData, loading } = useAuth();
  
  if (loading) return <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
      <div className="relative">
         <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full scale-150 animate-pulse"></div>
         <Cat className="w-16 h-16 text-purple-400 animate-bounce relative z-10" />
      </div>
      <div className="mt-6 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-emerald-400 animate-pulse">
         Waking up the cats...
      </div>
    </div>;
  if (!user) return <Navigate to="/login" replace />;
  if (userData?.blocked) return <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-red-500 font-bold text-xl"><h1 className="text-3xl mb-4">Account Blocked</h1><p>Please contact support.</p></div>;
  if (adminOnly && userData?.role !== 'admin') return <Navigate to="/" replace />;
  
  return <Layout>{children}</Layout>;
};

import React from 'react';
const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col h-full w-full relative">
        <Routes location={location}>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PublicRoute><App /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/pricing" element={<PublicRoute><Pricing /></PublicRoute>} />
        <Route path="/tutorial" element={<PublicRoute><Tutorial /></PublicRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { userData, loading } = useAuth();
  if (loading) return <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
      <div className="relative">
         <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full scale-150 animate-pulse"></div>
         <Cat className="w-16 h-16 text-purple-400 animate-bounce relative z-10" />
      </div>
      <div className="mt-6 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-emerald-400 animate-pulse">
         Waking up the cats...
      </div>
    </div>;
  if (userData?.blocked) return <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-red-500 font-bold text-xl"><h1 className="text-3xl mb-4">Account Blocked</h1><p>Please contact support.</p></div>;
  
  return <Layout>{children}</Layout>;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
