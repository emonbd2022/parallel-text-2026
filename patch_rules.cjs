const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf-8');

content = content.replace(
  "['role', 'unlimited', 'blocked']",
  "['role', 'unlimited', 'blocked', 'plan', 'planStartDate', 'planEndDate']"
);

fs.writeFileSync('firestore.rules', content);
