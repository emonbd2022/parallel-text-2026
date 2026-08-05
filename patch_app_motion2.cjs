const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// The closing tag is currently incorrect, let's fix the opening tag
code = code.replace(
  `<div className="h-full w-full flex overflow-hidden">`,
  `<motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="h-full w-full flex overflow-hidden"
    >`
);

fs.writeFileSync('src/App.tsx', code);
