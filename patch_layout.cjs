const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const injection = `
  const handleOpenNotifications = () => {
      const willShow = !showNotifications;
      setShowNotifications(willShow);
      if (willShow) {
          notifications.filter(n => !n.read).forEach(n => {
              updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(console.error);
          });
      }
  };
`;

code = code.replace("  useEffect(() => {\n    let unsub = () => {};\n    try {\n        unsub = onSnapshot(doc(db, 'settings', 'general')", injection + "\n  useEffect(() => {\n    let unsub = () => {};\n    try {\n        unsub = onSnapshot(doc(db, 'settings', 'general')");

code = code.replace("onClick={() => setShowNotifications(!showNotifications)}", "onClick={handleOpenNotifications}");

fs.writeFileSync('src/components/Layout.tsx', code);
