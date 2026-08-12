const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

code = code.replace(
  `import { doc, getDoc, onSnapshot, collection, query, where, updateDoc, orderBy } from 'firebase/firestore';`,
  `import { doc, getDoc, onSnapshot, collection, query, where, updateDoc, orderBy, limit } from 'firebase/firestore';`
);

code = code.replace(
  `        const q = query(collection(db, 'notifications'), where('targetUid', 'in', targets), orderBy('createdAt', 'desc'));`,
  `        const q = query(collection(db, 'notifications'), where('targetUid', 'in', targets), orderBy('createdAt', 'desc'), limit(20));`
);

const oldSettings = `    let unsub = () => {};
    try {
        unsub = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
          if (doc.exists()) {
            setMaintenanceMode(doc.data().maintenanceMode || false);
          }
        }, (err) => {
           console.warn("Could not load settings:", err);
        });
    } catch (e) {
        console.warn("Error setting up settings listener:", e);
    }
    return () => unsub();`;

const newSettings = `    const loadSettings = async () => {
        try {
            const docSnap = await getDoc(doc(db, 'settings', 'general'));
            if (docSnap.exists()) {
                setMaintenanceMode(docSnap.data().maintenanceMode || false);
            }
        } catch (e) {
            console.warn("Error loading settings:", e);
        }
    };
    loadSettings();`;

code = code.replace(oldSettings, newSettings);

fs.writeFileSync('src/components/Layout.tsx', code);
