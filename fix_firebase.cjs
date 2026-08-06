const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

code = code.replace(
  "import { initializeFirestore } from 'firebase/firestore';",
  "import { initializeFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';"
);

const initDbBlock = `    if (dbId) {
      db = initializeFirestore(app, firestoreSettings, dbId);
    } else {
      db = initializeFirestore(app, firestoreSettings);
    }`;

const newInitDbBlock = `    if (dbId) {
      db = initializeFirestore(app, firestoreSettings, dbId);
    } else {
      db = initializeFirestore(app, firestoreSettings);
    }
    
    // Enable offline persistence
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      console.warn("Firebase persistence error:", err.code);
    });`;

code = code.replace(initDbBlock, newInitDbBlock);
fs.writeFileSync('src/lib/firebase.ts', code);
