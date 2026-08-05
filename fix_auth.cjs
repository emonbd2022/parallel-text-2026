const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace(
  /            \/\/ Setup real-time listener for user data\s*onSnapshot\(userRef, \(doc\) => \{\s*if \(doc\.exists\(\)\) \{\s*setUserData\(doc\.data\(\) as UserData\);\s*\}\s*\}, \(err\) => \{\s*console\.error\("Error listening to user data:", err\);\s*\}\);/,
  `            // Setup real-time listener for user data
            const unsubSnapshot = onSnapshot(userRef, (doc) => {
              if (doc.exists()) {
                setUserData(doc.data() as UserData);
              }
            }, (err) => { 
               console.error("Error listening to user data:", err);
            });
            // We need to clean this up, so store it.
            if ((window as any)._userUnsub) {
                (window as any)._userUnsub();
            }
            (window as any)._userUnsub = unsubSnapshot;`
);

code = code.replace(
  /      \} else \{\s*setUserData\(null\);\s*\}/,
  `      } else {
        setUserData(null);
        if ((window as any)._userUnsub) {
            (window as any)._userUnsub();
            (window as any)._userUnsub = null;
        }
      }`
);

code = code.replace(
  "    return () => unsubscribe();",
  `    return () => {
      unsubscribe();
      if ((window as any)._userUnsub) {
        (window as any)._userUnsub();
        (window as any)._userUnsub = null;
      }
    };`
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
