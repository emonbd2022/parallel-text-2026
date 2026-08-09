const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldStatusUpdate = `          if (results[p.id]) {
              return {
                  ...p,
                  status: 'pending', // Pending for category phase
                 title: results[p.id].title, 
                 keywords: results[p.id].keywords,
                 category: '',
                 assignedKeyId: undefined,
                 metadataKeyId: keyObj.id,
                 retryAfter: undefined,
                 failedKeyIds: [],
                 usedModel: usedModel,
                 attempts: 0
              };
          }`;

const newStatusUpdate = `          if (results[p.id]) {
              return {
                  ...p,
                  status: 'done', // Skipped separate category phase as it's now in metadata
                 title: results[p.id].title, 
                 keywords: results[p.id].keywords,
                 category: results[p.id].category || '',
                 assignedKeyId: undefined,
                 metadataKeyId: keyObj.id,
                 retryAfter: undefined,
                 failedKeyIds: [],
                 usedModel: usedModel,
                 attempts: 0
              };
          }`;

code = code.replace(oldStatusUpdate, newStatusUpdate);
fs.writeFileSync('src/App.tsx', code);
