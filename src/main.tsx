import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { Pricing } from './pages/Pricing';
import { Layout } from './components/Layout';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, userData, loading } = useAuth();
  
  if (loading) return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-200">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (userData?.blocked) return <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-red-500 font-bold text-xl"><h1 className="text-3xl mb-4">Account Blocked</h1><p>Please contact support.</p></div>;
  if (adminOnly && userData?.role !== 'admin') return <Navigate to="/" replace />;
  
  return <Layout>{children}</Layout>;
};

import React from 'react';
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { userData, loading } = useAuth();
  if (loading) return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-200">Loading...</div>;
  if (userData?.blocked) return <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-red-500 font-bold text-xl"><h1 className="text-3xl mb-4">Account Blocked</h1><p>Please contact support.</p></div>;
  
  return <Layout>{children}</Layout>;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PublicRoute><App /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/pricing" element={<PublicRoute><Pricing /></PublicRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
