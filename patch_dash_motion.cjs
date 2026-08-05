const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');
if (code && !code.includes('motion/react')) {
  code = code.replace(
    `import { Activity, Clock, Image as ImageIcon, CreditCard, Shield, Star, LogOut, CheckCircle } from 'lucide-react';`,
    `import { Activity, Clock, Image as ImageIcon, CreditCard, Shield, Star, LogOut, CheckCircle } from 'lucide-react';\nimport { motion } from 'motion/react';`
  );
  code = code.replace(
    `return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">`,
    `return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex-1 overflow-y-auto p-8 custom-scrollbar"
    >`
  );
  code = code.replace(
    `    </div>
  );
};`,
    `    </motion.div>
  );
};`
  );
  fs.writeFileSync('src/pages/Dashboard.tsx', code);
}
