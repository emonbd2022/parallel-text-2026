const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace(
  /    const unsubscribe = onAuthStateChanged\(auth, async \(currentUser\) => \{/,
  `    let userUnsub: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {`
);

code = code.replace(
  /            \/\/ We need to clean this up, so store it\.\s*if \(\(window as any\)\._userUnsub\) \{\s*\(\(window as any\)\._userUnsub\)\(\);\s*\}\s*\(\(window as any\)\._userUnsub = unsubSnapshot;/,
  `            if (userUnsub) userUnsub();
            userUnsub = unsubSnapshot;`
);

code = code.replace(
  /        if \(\(window as any\)\._userUnsub\) \{\s*\(\(window as any\)\._userUnsub\)\(\);\s*\(\(window as any\)\._userUnsub = null;\s*\}/,
  `        if (userUnsub) {
            userUnsub();
            userUnsub = null;
        }`
);

code = code.replace(
  /      if \(\(window as any\)\._userUnsub\) \{\s*\(\(window as any\)\._userUnsub\)\(\);\s*\(\(window as any\)\._userUnsub = null;\s*\}/,
  `      if (userUnsub) {
        userUnsub();
      }`
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
