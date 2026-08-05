const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf-8');

code = code.replace(
  `const navItems = [
    { name: 'Pricing', path: '/pricing', icon: CreditCard },
  ];`,
  `const navItems = [
    { name: userData?.plan && userData.plan !== 'free' ? 'Upgrade' : 'Pricing', path: '/pricing', icon: CreditCard },
  ];`
);

code = code.replace(
  `<img src={userData.photoURL || 'https://via.placeholder.com/32'} alt="User" className={\`w-8 h-8 rounded-full border \${(userData.plan && userData.plan !== 'free') ? 'border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : 'border-slate-700'}\`} />
                  {(userData.plan && userData.plan !== 'free') && (
                     <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-purple-500 border border-slate-900 rounded-full" title={userData.plan.toUpperCase()} />
                  )}`,
  `<div className="relative group cursor-pointer" onClick={() => navigate('/dashboard')}>
                    <img src={userData.photoURL || 'https://via.placeholder.com/32'} alt="User" className="w-8 h-8 rounded-full border border-slate-700" />
                    {(userData.plan && userData.plan !== 'free') && (
                       <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shadow-sm border border-white/10 whitespace-nowrap z-10 pointer-events-none">
                         {userData.plan}
                       </div>
                    )}
                  </div>`
);

fs.writeFileSync('src/components/Layout.tsx', code);
