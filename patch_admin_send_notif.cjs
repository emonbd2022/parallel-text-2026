const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const importSearch = `import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getAggregateFromServer, sum, where, deleteDoc, getDoc, setDoc } from 'firebase/firestore';`;
const importReplace = `import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getAggregateFromServer, sum, where, deleteDoc, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';`;
code = code.replace(importSearch, importReplace);

const fnSearch = `  const handleResetCredits = async (uid: string) => {`;
const fnReplace = `  const handleSendNotification = async (uid: string) => {
      const msg = prompt('Enter notification message for this user:');
      if (!msg) return;
      try {
          await addDoc(collection(db, 'notifications'), {
              targetUid: uid,
              type: 'admin_msg',
              message: msg,
              read: false,
              createdAt: serverTimestamp()
          });
          alert('Notification sent!');
      } catch (e) {
          console.error(e);
          alert('Failed to send notification');
      }
  };

  const handleResetCredits = async (uid: string) => {`;
code = code.replace(fnSearch, fnReplace);

const actionSearch = `                            <button 
                                onClick={() => handleResetCredits(user.uid)}
                                disabled={user.uid === currentAdmin?.uid}
                                className="px-3 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Reset Credits
                            </button>`;
const actionReplace = `                            <button 
                                onClick={() => handleResetCredits(user.uid)}
                                disabled={user.uid === currentAdmin?.uid}
                                className="px-3 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Reset Credits
                            </button>
                            <button 
                                onClick={() => handleSendNotification(user.uid)}
                                className="px-3 py-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded text-xs font-bold transition-colors"
                            >
                                Notify
                            </button>`;
code = code.replace(actionSearch, actionReplace);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
