const fs = require('fs');
let code = fs.readFileSync('src/components/StatisticsModal.tsx', 'utf8');

code = code.replace(
    "const startOfWeek = startOfDay - (now.getDay() * 24 * 60 * 60 * 1000);",
    "const startOfWeek = now.getTime() - (7 * 24 * 60 * 60 * 1000);"
);

code = code.replace(
    "const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();",
    "const startOfMonth = now.getTime() - (30 * 24 * 60 * 60 * 1000);"
);

code = code.replace(">This Week<", ">Last 7 Days<");
code = code.replace(">This Month<", ">Last 30 Days<");

fs.writeFileSync('src/components/StatisticsModal.tsx', code);
