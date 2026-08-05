const fs = require('fs');
let content = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf-8');

content = content.replace(
  "role: 'admin' | 'user';",
  "role: 'admin' | 'user';\n  plan?: 'free' | 'starter' | 'pro' | 'elite' | 'unlimited';\n  planStartDate?: string;\n  planEndDate?: string;"
);

content = content.replace(
  "role: isFirstUser ? 'admin' : 'user',",
  "role: isFirstUser ? 'admin' : 'user',\n              plan: 'free',"
);

content = content.replace(
  "role: 'user',",
  "role: 'user',\n            plan: 'free',"
);

fs.writeFileSync('src/contexts/AuthContext.tsx', content);
