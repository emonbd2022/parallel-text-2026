const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const oldCode = `        const targets = [userData.uid, 'all'];
        if (userData.role === 'admin') {
            targets.push('admin');
        }
        const q = query(collection(db, 'notifications'), where('targetUid', 'in', targets), orderBy('createdAt', 'desc'));
        unsub = onSnapshot(q, (snapshot) => {
            const hiddenNotifs = JSON.parse(localStorage.getItem('hidden_notifs_v1') || '[]');
            const notifs: any[] = [];
            snapshot.forEach(d => {
                const data = d.data();
                if (data.targetUid === 'all' && hiddenNotifs.includes(d.id)) return;
                notifs.push({ id: d.id, ...data });
            });
            setNotifications(notifs);
        }, (err) => {
           console.warn("Could not load notifications:", err);
        });`;

const newCode = `        const targets = [userData.uid];
        if (userData.role === 'admin') {
            targets.push('admin');
        }
        const q = query(collection(db, 'notifications'), where('targetUid', 'in', targets), orderBy('createdAt', 'desc'));
        unsub = onSnapshot(q, (snapshot) => {
            const notifs: any[] = [];
            snapshot.forEach(d => {
                notifs.push({ id: d.id, ...d.data() });
            });
            setNotifications(notifs);
        }, (err) => {
           console.warn("Could not load notifications:", err);
        });`;

code = code.replace(oldCode, newCode);

const oldCount = `  const unreadCount = notifications.filter(n => !n.read && n.targetUid !== 'all').length + notifications.filter(n => n.targetUid === 'all').length;

  const handleMarkAsRead = async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (notif?.targetUid === 'all') {
        const hiddenNotifs = JSON.parse(localStorage.getItem('hidden_notifs_v1') || '[]');
        hiddenNotifs.push(id);
        localStorage.setItem('hidden_notifs_v1', JSON.stringify(hiddenNotifs));
        setNotifications(prev => prev.filter(n => n.id !== id));
    } else {
        await updateDoc(doc(db, 'notifications', id), { read: true });
    }
  };`;

const newCount = `  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
      await updateDoc(doc(db, 'notifications', id), { read: true });
  };`;

code = code.replace(oldCount, newCount);
fs.writeFileSync('src/components/Layout.tsx', code);
