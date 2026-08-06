const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  `} else {
      const savedSecs = completedItems.length * manualSecondsPerImage;
      const savedH = Math.floor(savedSecs / 3600);
      const savedM = Math.floor((savedSecs % 3600) / 60);
      const savedS = savedSecs % 60;
      
      if (savedH > 0) {
        timeSavedStr = \`\${savedH}h \${savedM}m\`;
      } else if (savedM > 0) {
        timeSavedStr = \`\${savedM}m \${savedS}s\`;
      } else {
        timeSavedStr = \`\${savedS}s\`;
      }
    }`,
  ``
);

fs.writeFileSync('src/App.tsx', code);
