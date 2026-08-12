const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

const notifCreateTarget = `      allow create: if isAdmin();`;
const notifCreateNew = `      allow create: if isAdmin() || (isAuthenticated() && request.resource.data.targetUid == 'admin');`;

rules = rules.replace(notifCreateTarget, notifCreateNew);
fs.writeFileSync('firestore.rules', rules);
