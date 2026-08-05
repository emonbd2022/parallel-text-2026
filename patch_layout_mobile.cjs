const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf-8');

code = code.replace(
  `<img src={userData.photoURL || 'https://via.placeholder.com/32'} alt="User" className="w-10 h-10 rounded-full border border-slate-700" />
              <div>
                <div className="font-bold">{userData.nickname}</div>`,
  `<div className="relative cursor-pointer" onClick={() => { navigate('/dashboard'); setMobileMenu(false); }}>
                 <img src={userData.photoURL || 'https://via.placeholder.com/32'} alt="User" className="w-10 h-10 rounded-full border border-slate-700" />
                 {(userData.plan && userData.plan !== 'free') && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shadow-sm border border-white/10 whitespace-nowrap z-10 pointer-events-none">
                      {userData.plan}
                    </div>
                 )}
               </div>
              <div className="ml-2">
                <div className="font-bold">{userData.nickname}</div>`
);

fs.writeFileSync('src/components/Layout.tsx', code);
