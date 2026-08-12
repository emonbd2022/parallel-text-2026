const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const exportTarget = `          if (!userData.unlimited) {
              updates.credits = increment(-numExported);
          }
          
          updateDoc(doc(db, 'users', userData.uid), updates).catch(e => console.error("Failed to update user stats:", e));
          
          addDoc(collection(db, 'activity_logs'), {
              uid: userData.uid,
              imagesProcessed: numExported,
              apiRequests: totalRequests,
              timestamp: serverTimestamp()
          }).catch(e => console.error("Failed to add activity log:", e));
    
          // Save to Firestore so it persists across cache clears
          try {
            addDoc(collection(db, 'csv_exports'), {
              uid: userData.uid,
              filename: exportFileName,
              csvData: csvContent,
              createdAt: Date.now()
            });
          } catch (err) {
            console.error("Failed to save CSV to Firestore:", err);
          }`;

const exportReplacement = `          if (!userData.unlimited) {
              updates.credits = increment(-numExported);
          }
          
          updateDoc(doc(db, 'users', userData.uid), updates).catch(e => console.error("Failed to update user stats:", e));`;

code = code.replace(exportTarget, exportReplacement);

const updatesTarget = `          const updates: any = {
              totalProcessedImages: increment(numExported),
              'appData.logs': logs,
              'appData.modelStats': modelStats
          };`;

const updatesReplacement = `          const updates: any = {
              totalProcessedImages: increment(numExported)
          };`;
code = code.replace(updatesTarget, updatesReplacement);

fs.writeFileSync('src/App.tsx', code);
