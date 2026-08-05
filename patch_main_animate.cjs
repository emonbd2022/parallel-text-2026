const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf-8');

code = code.replace(
  `import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';`,
  `import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';\nimport { AnimatePresence } from 'motion/react';`
);

code = code.replace(
  `<Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PublicRoute><App /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/pricing" element={<PublicRoute><Pricing /></PublicRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        </Routes>`,
  `<AnimatedRoutes />`
);

code = code.replace(
  `const PublicRoute = ({ children }: { children: React.ReactNode }) => {`,
  `const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PublicRoute><App /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/pricing" element={<PublicRoute><Pricing /></PublicRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      </Routes>
    </AnimatePresence>
  );
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {`
);

fs.writeFileSync('src/main.tsx', code);
