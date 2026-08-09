const fs = require('fs');
let code = fs.readFileSync('src/lib/sync.ts', 'utf8');

const oldUpdate = `      await updateDoc(doc(db, 'users', uid), {
        appData: cleanData
      });`;

const newUpdate = `      const updates: any = {};
      Object.keys(cleanData).forEach(key => {
        updates[\`appData.\${key}\`] = cleanData[key];
      });
      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', uid), updates);
      }`;

code = code.replace(oldUpdate, newUpdate);
fs.writeFileSync('src/lib/sync.ts', code);
