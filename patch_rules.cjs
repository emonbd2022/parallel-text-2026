const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(/allow read: if isAuthenticated\(\) && \(resource\.data\.targetUid == request\.auth\.uid \|\| \(resource\.data\.targetUid == 'admin' && isAdmin\(\)\)\);/, 
  "allow read: if isAuthenticated() && (resource.data.targetUid == request.auth.uid || resource.data.targetUid == 'all' || (resource.data.targetUid == 'admin' && isAdmin()));");

code = code.replace(/allow create: if isAuthenticated\(\);/,
  "allow create: if isAdmin();"); // Only admin can create notifications now

fs.writeFileSync('firestore.rules', code);
