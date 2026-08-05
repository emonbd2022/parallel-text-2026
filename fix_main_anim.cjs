const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf-8');

code = code.replace(
  /<Routes location=\{location\}( key=\{location.pathname\})?>/,
  `<Routes location={location}>`
);

code = code.replace(
  `<AnimatePresence mode="wait">
      <Routes location={location}>`,
  `<AnimatePresence mode="wait">
      <motion.div key={location.pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col h-full w-full relative">
        <Routes location={location}>`
);

code = code.replace(
  `</Routes>
    </AnimatePresence>`,
  `</Routes>
      </motion.div>
    </AnimatePresence>`
);

if (!code.includes('import { motion')) {
  code = code.replace(`import { AnimatePresence }`, `import { AnimatePresence, motion }`);
}

fs.writeFileSync('src/main.tsx', code);
