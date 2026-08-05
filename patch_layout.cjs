const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf-8');

// Replace navItems logic for Pricing -> Upgrade
code = code.replace(
  "const navItems = [\n    { name: 'Pricing', path: '/pricing', icon: CreditCard },\n  ];\n  if (userData) {\n    navItems.splice(1, 0, { name: 'Dashboard', path: '/dashboard', icon: User });\n  }",
  "const navItems = [\n    { name: (userData?.plan && userData.plan !== 'free') ? 'Upgrade' : 'Pricing', path: '/pricing', icon: CreditCard },\n  ];\n  if (userData) {\n    navItems.splice(1, 0, { name: 'Dashboard', path: '/dashboard', icon: User });\n  }"
);

// Add loading skeleton in place of desktop nav
const loadingDesktop = `
        <nav className="hidden md:flex items-center gap-2">
          <div className="w-20 h-8 bg-slate-800 rounded-lg animate-pulse" />
          <div className="w-px h-6 bg-slate-800 mx-2" />
          <div className="w-24 h-8 bg-slate-800 rounded-lg animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse ml-2" />
        </nav>
`;

code = code.replace(
  "{/* Desktop Nav */}\n        <nav className=\"hidden md:flex items-center gap-2\">",
  `{/* Desktop Nav */}\n        {loading ? (${loadingDesktop}) : (<nav className="hidden md:flex items-center gap-2">`
);

// Close the tag for desktop nav
code = code.replace(
  "</nav>\n        {/* Mobile Nav Toggle */}",
  "</nav>)}\n        {/* Mobile Nav Toggle */}"
);

// Update user badge in desktop nav
code = code.replace(
  "<img src={userData.photoURL || 'https://via.placeholder.com/32'} alt=\"User\" className=\"w-8 h-8 rounded-full border border-slate-700\" />",
  `<div className="relative">
                  <img src={userData.photoURL || 'https://via.placeholder.com/32'} alt="User" className={\`w-8 h-8 rounded-full border \${(userData.plan && userData.plan !== 'free') ? 'border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'border-slate-700'}\`} />
                  {(userData.plan && userData.plan !== 'free') && (
                     <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-purple-500 border border-slate-900 rounded-full" title={userData.plan.toUpperCase()} />
                  )}
                </div>`
);

fs.writeFileSync('src/components/Layout.tsx', code);
