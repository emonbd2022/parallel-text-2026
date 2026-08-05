const fs = require('fs');

let dash = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');
if (!dash.includes('motion/react')) {
  dash = "import { motion } from 'motion/react';\n" + dash;
  fs.writeFileSync('src/pages/Dashboard.tsx', dash);
}

let admin = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf-8');
if (!admin.includes('motion/react')) {
  admin = "import { motion } from 'motion/react';\n" + admin;
  fs.writeFileSync('src/pages/AdminDashboard.tsx', admin);
}

let main = fs.readFileSync('src/main.tsx', 'utf-8');
main = main.replace('<Routes location={location} key={location.pathname}>', '<Routes location={location}>');
fs.writeFileSync('src/main.tsx', main);

