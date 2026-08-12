const fs = require('fs');

let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
layout = layout.replace(
  `        const targets = [userData.uid];`,
  `        const targets = [userData.uid, 'all'];`
);
fs.writeFileSync('src/components/Layout.tsx', layout);

let admin = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');
const oldNotif = `              const allUsersSnap = await getDocs(collection(db, 'users'));
              const batchPromises = allUsersSnap.docs.map(docSnap => 
                  addDoc(collection(db, 'notifications'), {
                      targetUid: docSnap.id,
                      type: 'admin_msg',
                      message: notifModal.message,
                      read: false,
                      createdAt: serverTimestamp()
                  })
              );
              await Promise.all(batchPromises);`;

const newNotif = `              await addDoc(collection(db, 'notifications'), {
                  targetUid: 'all',
                  type: 'admin_msg',
                  message: notifModal.message,
                  read: false,
                  createdAt: serverTimestamp()
              });`;

admin = admin.replace(oldNotif, newNotif);
fs.writeFileSync('src/pages/AdminDashboard.tsx', admin);

