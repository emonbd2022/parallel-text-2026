const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const settingsSearch = `  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        setMaintenanceMode(doc.data().maintenanceMode || false);
      }
    });
    return () => unsub();
  }, []);`;
  
const settingsReplace = `  useEffect(() => {
    let unsub = () => {};
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
    return () => unsub();
  }, []);`;

code = code.replace(settingsSearch, settingsReplace);

const notifSearch = `  useEffect(() => {
    if (!userData) return;
    const q = query(collection(db, 'notifications'), where('targetUid', 'in', [userData.uid, userData.role === 'admin' ? 'admin' : 'none']), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
        const notifs: any[] = [];
        snapshot.forEach(d => notifs.push({ id: d.id, ...d.data() }));
        setNotifications(notifs);
    });
    return () => unsub();
  }, [userData]);`;

const notifReplace = `  useEffect(() => {
    if (!userData) return;
    let unsub = () => {};
    try {
        const q = query(collection(db, 'notifications'), where('targetUid', 'in', [userData.uid, userData.role === 'admin' ? 'admin' : 'none']), orderBy('createdAt', 'desc'));
        unsub = onSnapshot(q, (snapshot) => {
            const notifs: any[] = [];
            snapshot.forEach(d => notifs.push({ id: d.id, ...d.data() }));
            setNotifications(notifs);
        }, (err) => {
           console.warn("Could not load notifications:", err);
        });
    } catch (e) {
        console.warn("Error setting up notifications listener:", e);
    }
    return () => unsub();
  }, [userData]);`;

code = code.replace(notifSearch, notifReplace);

fs.writeFileSync('src/components/Layout.tsx', code);
