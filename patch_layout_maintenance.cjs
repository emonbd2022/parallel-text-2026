const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

code = code.replace(
  `import { Menu, LogOut, Home, User, CreditCard, Shield, X, ChevronLeft, Layers } from 'lucide-react';`,
  `import { Menu, LogOut, Home, User, CreditCard, Shield, X, ChevronLeft, Layers, Wrench, Bell } from 'lucide-react';\nimport { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';\nimport { db } from '../lib/firebase';\nimport { useEffect } from 'react';`
);

const componentStart = `export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);`;

const componentReplace = `export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        setMaintenanceMode(doc.data().maintenanceMode || false);
      }
    });
    return () => unsub();
  }, []);
`;
code = code.replace(componentStart, componentReplace);

const renderStart = `  return (
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden text-slate-200 selection:bg-purple-500/30 font-sans">`;

const renderReplace = `  if (maintenanceMode && userData?.role !== 'admin' && location.pathname !== '/login') {
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
    <div className="h-screen w-screen bg-slate-950 flex flex-col overflow-hidden text-slate-200 selection:bg-purple-500/30 font-sans">`;

code = code.replace(renderStart, renderReplace);
fs.writeFileSync('src/components/Layout.tsx', code);
