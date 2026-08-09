const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldCode = `          addDoc(collection(db, 'csv_exports'), {
            uid: userData.uid,
            filename: exportFileName,
            csvData: csvContent,
            createdAt: serverTimestamp()
          }).catch(err => console.error("Failed to save CSV to Firestore:", err));`;

const newCode = `          // Save to localStorage instead of Firestore to save server costs
          try {
            const localExports = JSON.parse(localStorage.getItem('parrarel_exports_v1') || '[]');
            const newExport = {
              id: Math.random().toString(36).slice(2),
              uid: userData.uid,
              filename: exportFileName,
              csvData: csvContent,
              createdAt: Date.now()
            };
            localExports.push(newExport);
            localStorage.setItem('parrarel_exports_v1', JSON.stringify(localExports));
          } catch (err) {
            console.error("Failed to save CSV to localStorage:", err);
          }`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/App.tsx', code);
