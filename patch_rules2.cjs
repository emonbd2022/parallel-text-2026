const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  `allow read, delete: if isAuthenticated() && resource.data.uid == request.auth.uid;`,
  `allow read, delete: if isAuthenticated() && (resource.data.uid == request.auth.uid || isAdmin());`
);

fs.writeFileSync('firestore.rules', rules);
