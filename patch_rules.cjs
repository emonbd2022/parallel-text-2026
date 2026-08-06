const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

const exportRules = `    match /csv_exports/{exportId} {
      allow read, delete: if isAuthenticated() && resource.data.uid == request.auth.uid;
      allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;
      allow update: if false;
    }`;

const newRules = `    match /csv_exports/{exportId} {
      allow read, delete: if isAuthenticated() && resource.data.uid == request.auth.uid;
      allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;
      allow update: if false;
    }
    
    match /activity_logs/{logId} {
      allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;
      allow read: if isAdmin();
      allow update, delete: if false;
    }`;

rules = rules.replace(exportRules, newRules);
fs.writeFileSync('firestore.rules', rules);
