const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// The issue is around line 930
// I will just extract everything from `    let timeSavedStr = '0s';` to `setExportStats` and rewrite it.

const startStr = "let timeSavedStr = '0s';";
const endStr = "setExportStats({ count: completedItems.length";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex > -1 && endIndex > -1) {
  const newBlock = `let timeSavedStr = '0s';
    const manualSecondsPerImage = 120;
    
    {
      const elapsedSecs = Math.floor(elapsedMs / 1000);
      const m = Math.floor(elapsedSecs / 60);
      const s = elapsedSecs % 60;
      timeStr = m > 0 ? \`\${m}m \${s}s\` : \`\${s}s\`;
      
      const totalManualSeconds = completedItems.length * manualSecondsPerImage;
      const savedSecs = Math.max(0, totalManualSeconds - elapsedSecs);
      
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
    }
    
    `;
    code = code.substring(0, startIndex) + newBlock + code.substring(endIndex);
    fs.writeFileSync('src/App.tsx', code);
}
