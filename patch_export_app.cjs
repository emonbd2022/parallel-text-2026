const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldExportUpdate = `          const updates: any = {
              totalProcessedImages: increment(numExported)
          };
          if (!userData.unlimited) {
              updates.credits = increment(-numExported);
          }
          
          updateDoc(doc(db, 'users', userData.uid), updates).catch(e => console.error("Failed to update user stats:", e));`;

const newExportUpdate = `          const updates: any = {
              totalProcessedImages: increment(numExported),
              'appData.logs': logs,
              'appData.modelStats': modelStats
          };
          if (!userData.unlimited) {
              updates.credits = increment(-numExported);
          }
          
          updateDoc(doc(db, 'users', userData.uid), updates).catch(e => console.error("Failed to update user stats:", e));`;

code = code.replace(oldExportUpdate, newExportUpdate);
fs.writeFileSync('src/App.tsx', code);
