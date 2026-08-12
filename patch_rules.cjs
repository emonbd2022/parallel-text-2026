const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

const csvSection = /    \/\/ =========================\n    \/\/ CSV Exports\n    \/\/ =========================\n    match \/csv_exports\/\{exportId\} \{[\s\S]*?allow update: if false;\n    \}/m;
rules = rules.replace(csvSection, '');

const activitySection = /    \/\/ =========================\n    \/\/ Activity Logs\n    \/\/ =========================\n    match \/activity_logs\/\{logId\} \{[\s\S]*?allow update, delete: if false;\n    \}/m;
rules = rules.replace(activitySection, '');

fs.writeFileSync('firestore.rules', rules);
