import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signInWithGoogle, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Layers, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in your Firebase Console. Please go to Authentication > Sign-in method and enable Google provider.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError(`This domain (${window.location.hostname}) is not authorized. Add it to Firebase Console > Authentication > Settings > Authorized domains.`);
      } else {
        setError(err.message || 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl aspect-square bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-md w-full bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-2xl flex flex-col items-center relative z-10"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: 360 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-emerald-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
        >
          <Layers className="w-8 h-8 text-white" />
        </motion.div>
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold text-white">Parallel Text</h1>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">(version : 26.0.0)</span>
        </div>
        
        {!auth ? (
          <div className="w-full bg-orange-950/30 border border-orange-500/50 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 text-orange-400 mb-3 font-bold">
              <AlertTriangle className="w-5 h-5" />
              Firebase Setup Required
            </div>
            <p className="text-slate-300 text-sm mb-4">
              To enable authentication and database features, you need to configure Firebase environment variables.
            </p>
            <ol className="text-sm text-slate-400 list-decimal pl-4 space-y-2">
              <li>Create a Firebase project at console.firebase.google.com</li>
              <li>Enable Google Authentication</li>
              <li>Enable Firestore Database</li>
              <li>Add the config to Vercel environment variables or <code className="bg-slate-900 px-1 py-0.5 rounded">.env.local</code>:</li>
            </ol>
            <div className="mt-4 bg-slate-950 p-3 rounded-lg text-xs font-mono text-slate-500 overflow-x-auto">
              VITE_FIREBASE_API_KEY=...<br/>
              VITE_FIREBASE_AUTH_DOMAIN=...<br/>
              VITE_FIREBASE_PROJECT_ID=...<br/>
              VITE_FIREBASE_STORAGE_BUCKET=...<br/>
              VITE_FIREBASE_MESSAGING_SENDER_ID=...<br/>
              VITE_FIREBASE_APP_ID=...
            </div>
          </div>
        ) : (
          <>
            <p className="text-slate-400 text-center mb-8">Sign in to start processing images in bulk with Gemini AI.</p>
            
            {error && <div className="w-full p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm mb-4 text-center">{error}</div>}
            
            <button 
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-white text-slate-900 hover:bg-slate-100 flex items-center justify-center gap-3 px-6 py-3 rounded-xl font-bold transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : (
                <>
                  <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                      <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                      <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                      <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                      <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                    </g>
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};
