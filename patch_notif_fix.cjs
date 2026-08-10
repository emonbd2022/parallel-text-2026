const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const oldFunc = `  const handleSendNotificationAction = async () => {
      if (!notifModal.message.trim()) return;
      setIsSendingGlobal(true);
      try {
          if (notifModal.targetUid) {
              await addDoc(collection(db, 'notifications'), {
                  targetUid: notifModal.targetUid,
                  type: 'admin_msg',
                  message: notifModal.message,
                  read: false,
                  createdAt: serverTimestamp()
              });
          } else {
              await addDoc(collection(db, 'notifications'), {
                  targetUid: 'all',
                  type: 'admin_msg',
                  message: notifModal.message,
                  read: false,
                  createdAt: serverTimestamp()
              });
          }
          setNotifModal({isOpen: false, message: ''});
      } catch (e) {
          console.error(e);
      } finally {
          setIsSendingGlobal(false);
      }
  };`;

const newFunc = `  const handleSendNotificationAction = async () => {
      if (!notifModal.message.trim()) return;
      setIsSendingGlobal(true);
      try {
          if (notifModal.targetUid) {
              await addDoc(collection(db, 'notifications'), {
                  targetUid: notifModal.targetUid,
                  type: 'admin_msg',
                  message: notifModal.message,
                  read: false,
                  createdAt: serverTimestamp()
              });
          } else {
              const allUsersSnap = await getDocs(collection(db, 'users'));
              const batchPromises = allUsersSnap.docs.map(docSnap => 
                  addDoc(collection(db, 'notifications'), {
                      targetUid: docSnap.id,
                      type: 'admin_msg',
                      message: notifModal.message,
                      read: false,
                      createdAt: serverTimestamp()
                  })
              );
              await Promise.all(batchPromises);
          }
          setNotifModal({isOpen: false, message: ''});
      } catch (e) {
          console.error(e);
      } finally {
          setIsSendingGlobal(false);
      }
  };`;

code = code.replace(oldFunc, newFunc);
fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
