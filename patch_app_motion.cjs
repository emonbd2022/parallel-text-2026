const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  `import confetti from 'canvas-confetti';`,
  `import confetti from 'canvas-confetti';\nimport { motion } from 'motion/react';`
);

code = code.replace(
  `<div className="flex flex-1 overflow-hidden relative bg-[#0B0F19]">`,
  `<motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-1 overflow-hidden relative bg-[#0B0F19]"
    >`
);

// Close tag replacement for App.tsx is tricky, we can do it with regex or index.
// Let's replace the last `</div>\n    </div>\n  </>\n  );`
const lastDivIndex = code.lastIndexOf(`</div>\n  </>\n  );`);
if (lastDivIndex > -1) {
  code = code.substring(0, lastDivIndex) + `</motion.div>\n  </>\n  );` + code.substring(lastDivIndex + `</div>\n  </>\n  );`.length);
}

fs.writeFileSync('src/App.tsx', code);
