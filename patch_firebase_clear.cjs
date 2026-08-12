const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase.ts', 'utf8');

const importRegex = /import \{ initializeFirestore \} from 'firebase\/firestore';/;
code = code.replace(importRegex, "import { initializeFirestore, clearIndexedDbPersistence } from 'firebase/firestore';");

const initRegex = /    if \(dbId\) \{\n      db = initializeFirestore\(app, firestoreSettings, dbId\);\n    \} else \{\n      db = initializeFirestore\(app, firestoreSettings\);\n    \}/;

const replacement = `    if (dbId) {
      db = initializeFirestore(app, firestoreSettings, dbId);
    } else {
      db = initializeFirestore(app, firestoreSettings);
    }
    
    // Clear any stuck offline queues that are causing quota exhaustion loops
    clearIndexedDbPersistence(db).catch(() => {});
`;

code = code.replace(initRegex, replacement);

fs.writeFileSync('src/lib/firebase.ts', code);
