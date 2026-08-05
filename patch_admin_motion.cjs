const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf-8');
if (code && !code.includes('motion/react')) {
  code = code.replace(
    `import { Users, Search, Edit2, Shield, Activity, Save, X, Ban, CheckCircle } from 'lucide-react';`,
    `import { Users, Search, Edit2, Shield, Activity, Save, X, Ban, CheckCircle } from 'lucide-react';\nimport { motion } from 'motion/react';`
  );
  code = code.replace(
    `return (
    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">`,
    `return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
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
  fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
}
