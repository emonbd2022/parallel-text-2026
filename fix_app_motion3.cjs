const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
code = code.replace(
  `import { motion } from 'motion/react';`,
  `import { motion, AnimatePresence } from 'motion/react';`
);
fs.writeFileSync('src/App.tsx', code);
