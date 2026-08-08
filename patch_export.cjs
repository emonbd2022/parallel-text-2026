const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldStatsUpdate = `
    // Update stats and save to Firestore
    if (userData) {
      const numExported = completedItems.length;
      const totalRequests = sessionRequestCountRef.current;
      
      const updates: any = {
          totalProcessedImages: increment(numExported)
      };
      if (!userData.unlimited) {
          updates.credits = increment(-numExported);
      }
      
      updateDoc(doc(db, 'users', userData.uid), updates).catch(e => console.error("Failed to update user stats:", e));
      
      addDoc(collection(db, 'activity_logs'), {
          uid: userData.uid,
          imagesProcessed: numExported,
          apiRequests: totalRequests,
          timestamp: serverTimestamp()
      }).catch(e => console.error("Failed to add activity log:", e));

      addDoc(collection(db, 'csv_exports'), {
        uid: userData.uid,
        filename: exportFileName,
        csvData: csvContent,
        createdAt: serverTimestamp()
      }).catch(err => console.error("Failed to save CSV to Firestore:", err));
    }
`;

const newStatsUpdate = `
    // Update stats and save to Firestore
    if (userData) {
      const newlyExportedItems = completedItems.filter(i => !(i as any).exported);
      const numExported = newlyExportedItems.length;
      
      if (numExported > 0) {
          const totalRequests = sessionRequestCountRef.current;
          
          const updates: any = {
              totalProcessedImages: increment(numExported)
          };
          if (!userData.unlimited) {
              updates.credits = increment(-numExported);
          }
          
          updateDoc(doc(db, 'users', userData.uid), updates).catch(e => console.error("Failed to update user stats:", e));
          
          addDoc(collection(db, 'activity_logs'), {
              uid: userData.uid,
              imagesProcessed: numExported,
              apiRequests: totalRequests,
              timestamp: serverTimestamp()
          }).catch(e => console.error("Failed to add activity log:", e));
    
          addDoc(collection(db, 'csv_exports'), {
            uid: userData.uid,
            filename: exportFileName,
            csvData: csvContent,
            createdAt: serverTimestamp()
          }).catch(err => console.error("Failed to save CSV to Firestore:", err));
          
          setItems(prev => prev.map(i => i.status === 'done' ? { ...i, exported: true } : i));
      }
    }
`;

code = code.replace(oldStatsUpdate, newStatsUpdate);

fs.writeFileSync('src/App.tsx', code);
