const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /setItems\(prev => prev\.map\(p => \{\s*if \(results\[p\.id\]\) \{\s*return \{\s*\.\.\.p,\s*status: 'done',\s*title: results\[p\.id\]\.title,\s*keywords: results\[p\.id\]\.keywords,\s*category: results\[p\.id\]\.category,\s*assignedKeyId: undefined,\s*retryAfter: undefined,\s*failedKeyIds: \[\],\s*\/\/ Success resets failures\s*usedModel: usedModel\s*\};\s*\}\s*return p;\s*\}\)\);/;

const replacement = `      setItems(prev => prev.map(p => {
          if (results[p.id]) {
              return { 
                 ...p, 
                 status: 'pending', // Pending for category phase
                 title: results[p.id].title, 
                 keywords: results[p.id].keywords,
                 category: '',
                 assignedKeyId: undefined,
                 retryAfter: undefined,
                 failedKeyIds: [],
                 usedModel: usedModel,
                 attempts: 0
              };
          }
          return p;
      }));`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/App.tsx', code);
