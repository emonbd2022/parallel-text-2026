const fs = require('fs');
let code = fs.readFileSync('src/pages/Login.tsx', 'utf-8');

code = code.replace(
  `import { Layers, AlertTriangle } from 'lucide-react';`,
  `import { Layers, AlertTriangle } from 'lucide-react';\nimport { motion } from 'motion/react';`
);

code = code.replace(
  `<div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-2xl flex flex-col items-center">`,
  `<div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl aspect-square bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="max-w-md w-full bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-2xl flex flex-col items-center relative z-10"
      >`
);

code = code.replace(
  `</button>
          </>
        )}
      </div>
    </div>`,
  `</button>
          </>
        )}
      </motion.div>
    </div>`
);

code = code.replace(
  `<div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-emerald-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]">
          <Layers className="w-8 h-8 text-white" />
        </div>`,
  `<motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: 360 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-emerald-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
        >
          <Layers className="w-8 h-8 text-white" />
        </motion.div>`
);

fs.writeFileSync('src/pages/Login.tsx', code);
