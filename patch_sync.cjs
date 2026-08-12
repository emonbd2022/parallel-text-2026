const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  `    if (cloudLoaded && userData) {
        syncUserDataToCloud(userData.uid, { history });
    }`,
  ''
);

code = code.replace(
  `    if (cloudLoaded && userData) {
        syncUserDataToCloud(userData.uid, { logs });
    }`,
  ''
);

code = code.replace(
  `    if (cloudLoaded && userData) {
        syncUserDataToCloud(userData.uid, { modelStats });
    }`,
  ''
);

fs.writeFileSync('src/App.tsx', code);
