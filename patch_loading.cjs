const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf-8');

const loadingScreen = `<div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
      <div className="relative">
         <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full scale-150 animate-pulse"></div>
         <Cat className="w-16 h-16 text-purple-400 animate-bounce relative z-10" />
      </div>
      <div className="mt-6 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-emerald-400 animate-pulse">
         Waking up the cats...
      </div>
    </div>`;

code = code.replace(
    "if (loading) return <div className=\"h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-200\">Loading...</div>;",
    `if (loading) return ${loadingScreen};`
);
code = code.replace(
    "if (loading) return <div className=\"h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-200\">Loading...</div>;",
    `if (loading) return ${loadingScreen};`
);

if (!code.includes('import { Cat }')) {
    code = code.replace("import { Layout } from './components/Layout';", "import { Layout } from './components/Layout';\nimport { Cat } from 'lucide-react';");
}

fs.writeFileSync('src/main.tsx', code);
