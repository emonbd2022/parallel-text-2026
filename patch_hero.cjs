const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldHero = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                           <path d="M12 13v8"/>
                           <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
                           <path d="m8 17 4-4 4 4"/>
                        </svg>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[20%] flex gap-3 pointer-events-none group-hover:animate-bounce">
                           <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_white]"></div>
                           <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_white]"></div>
                        </div>`;

const newHero = `<div className="flex flex-col items-center gap-4">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-emerald-500 flex items-center justify-center text-white shadow-[0_0_30px_rgba(168,85,247,0.5)] group-hover:animate-pulse-glow">
                                <Layers className="w-12 h-12 group-hover:animate-spin-slow" />
                            </div>
                            <span className="font-extrabold text-3xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-emerald-400">Parallel Text</span>
                        </div>`;

code = code.replace(oldHero, newHero);

// We need to import Layers in App.tsx if it's not imported
if (!code.includes('Layers')) {
    code = code.replace("import { Play, Pause, Square, Image as ImageIcon,", "import { Play, Pause, Square, Image as ImageIcon, Layers,");
}

fs.writeFileSync('src/App.tsx', code);
