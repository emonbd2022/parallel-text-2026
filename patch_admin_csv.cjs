const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const oldCode = `  const handleDeleteOldCsvs = () => {
    setConfirmAction({
      title: 'Delete Old CSVs',
      message: 'Are you sure you want to delete CSV exports older than 30 days?',
      onConfirm: async () => {
        setIsDeletingCsvs(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const q = query(collection(db, 'csv_exports'), where('createdAt', '<', thirtyDaysAgo));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      setConfirmAction(null);
      } catch (e) {
        console.error(e);
      } finally {
        setIsDeletingCsvs(false);
      }
    }});
  };

  const handleDeleteAllCsvs = () => {
    setConfirmAction({
      title: 'Delete All CSVs',
      message: 'WARNING: Are you sure you want to delete ALL CSV exports? This cannot be undone.',
      onConfirm: async () => {
        setIsDeletingCsvs(true);
    try {
      const snapshot = await getDocs(collection(db, 'csv_exports'));
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      setConfirmAction(null);
      } catch (e) {
        console.error(e);
      } finally {
        setIsDeletingCsvs(false);
      }
    }});
  };`;

code = code.replace(oldCode, '');

// also remove the buttons in the UI
code = code.replace(/<div className="flex gap-2 items-center">[\s\S]*?<\/div>\s*<\/div>/, '</div>');

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
