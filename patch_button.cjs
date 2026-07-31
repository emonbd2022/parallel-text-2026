const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
    "onClick={() => setIsProcessing(!isProcessing)}",
    "onClick={handleStartStop}"
);
fs.writeFileSync('src/App.tsx', content);
