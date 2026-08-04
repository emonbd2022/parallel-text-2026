const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace the dependency array
content = content.replace(
  "}, [keys, history, logs, config, modelStats, cloudLoaded, userData]);",
  "}, [keys, history, logs, config, modelStats, cloudLoaded, userData?.uid]);"
);

fs.writeFileSync('src/App.tsx', content);
