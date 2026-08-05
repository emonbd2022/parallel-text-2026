const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf-8');

code = code.replace(
  "if (!docSnap.exists()) {",
  "if (!docSnap.exists()) {"
);

code = code.replace(
  `} else {
            // Setup real-time listener for user data
            onSnapshot(userRef, (doc) => {
              if (doc.exists()) {
                setUserData(doc.data() as UserData);
              }
            }, (err) => { 
               console.error("Error listening to user data:", err);
            });
          }`,
  `} else {
            // Set initial data
            setUserData(docSnap.data() as UserData);
            // Setup real-time listener for user data
            onSnapshot(userRef, (doc) => {
              if (doc.exists()) {
                setUserData(doc.data() as UserData);
              }
            }, (err) => { 
               console.error("Error listening to user data:", err);
            });
          }`
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
