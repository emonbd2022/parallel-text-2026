const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const syncSearch = `        try {
          if (!userData.unlimited) {
            await updateDoc(doc(db, 'users', userData.uid), {
              credits: increment(-creditsToDeduct),
              totalProcessedImages: increment(imagesToAdd)
            });
          } else {
            await updateDoc(doc(db, 'users', userData.uid), {
              totalProcessedImages: increment(imagesToAdd)
            });
          }`;

const syncReplace = `        try {
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
          }`;
code = code.replace(syncSearch, syncReplace);
fs.writeFileSync('src/App.tsx', code);
