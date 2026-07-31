const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace("Ongoing ({items.filter", "On going ({items.filter");

fs.writeFileSync('src/App.tsx', content);
