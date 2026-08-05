const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

code = code.replace(
  `<>Valid until <strong className="text-white">{new Date(userData.planEndDate).toLocaleDateString()}</strong></>`,
  `userData.plan === 'unlimited' ? <>Lifetime</> : <>Valid until <strong className="text-white">{new Date(userData.planEndDate).toLocaleDateString()}</strong></>`
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
