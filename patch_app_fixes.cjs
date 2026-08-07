const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const intervalSearch = `        try {
          const updates: any = {
              totalProcessedImages: increment(imagesToAdd)
          };
          if (!userData.unlimited) {
              updates.credits = increment(-creditsToDeduct);
          }
          await updateDoc(doc(db, 'users', userData.uid), updates);
          
          if (imagesToAdd > 0) {
              await addDoc(collection(db, 'activity_logs'), {
                  uid: userData.uid,
                  imagesProcessed: imagesToAdd,
                  timestamp: serverTimestamp()
              });
          }
        } catch (e) {
          console.error('Failed to update credits', e);
          pendingCreditsRef.current += creditsToDeduct;
          pendingImagesRef.current += imagesToAdd;
        }`;

const intervalReplace = `        try {
          const updates: any = {
              totalProcessedImages: increment(imagesToAdd)
          };
          if (!userData.unlimited) {
              updates.credits = increment(-creditsToDeduct);
          }
          await updateDoc(doc(db, 'users', userData.uid), updates);
          
          if (imagesToAdd > 0) {
              try {
                  await addDoc(collection(db, 'activity_logs'), {
                      uid: userData.uid,
                      imagesProcessed: imagesToAdd,
                      timestamp: serverTimestamp()
                  });
              } catch (e) {
                  console.error('Failed to add activity log', e);
              }
          }
        } catch (e) {
          console.error('Failed to update credits', e);
          pendingCreditsRef.current += creditsToDeduct;
          pendingImagesRef.current += imagesToAdd;
        }`;
code = code.replace(intervalSearch, intervalReplace);

const exportSearch = `    const totalRequests = sessionRequestCountRef.current;
    
    let timeStr = '0s';`;

const exportReplace = `    const totalRequests = sessionRequestCountRef.current;
    sessionRequestCountRef.current = 0; // Reset for next session
    localStorage.setItem('sessionReqCount', '0');
    
    let timeStr = '0s';`;
code = code.replace(exportSearch, exportReplace);

fs.writeFileSync('src/App.tsx', code);
