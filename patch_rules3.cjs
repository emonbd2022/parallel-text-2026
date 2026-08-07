const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  `match /activity_logs/{logId} {`,
  `match /settings/{document} {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    match /notifications/{notifId} {
      allow read: if isAuthenticated() && (resource.data.targetUid == request.auth.uid || isAdmin() || resource.data.targetUid == 'admin');
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && (resource.data.targetUid == request.auth.uid || isAdmin());
    }

    match /activity_logs/{logId} {`
);

fs.writeFileSync('firestore.rules', rules);
