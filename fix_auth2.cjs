const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf-8');

code = code.replace(
  /} else \{\s*\/\/ Setup real-time listener for user data\s*onSnapshot\(userRef, \(doc\) => \{/g,
  `} else {
            // Set initial data
            setUserData(docSnap.data() as UserData);
            // Setup real-time listener for user data
            onSnapshot(userRef, (doc) => {`
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
