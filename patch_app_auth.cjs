const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'const { userData } = useAuth();',
  'const { userData, setUserData } = useAuth();'
);

const exportUpdates = `          updateDoc(doc(db, 'users', userData.uid), updates).catch(e => console.error("Failed to update user stats:", e));`;
const exportUpdatesNew = `          updateDoc(doc(db, 'users', userData.uid), updates).catch(e => console.error("Failed to update user stats:", e));
          
          setUserData(prev => prev ? {
              ...prev,
              totalProcessedImages: prev.totalProcessedImages + numExported,
              credits: prev.unlimited ? prev.credits : (prev.credits - numExported)
          } : null);`;

code = code.replace(exportUpdates, exportUpdatesNew);

fs.writeFileSync('src/App.tsx', code);
