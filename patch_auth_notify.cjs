const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace(
  `import { doc, getDoc, setDoc, onSnapshot, getDocs, collection, limit, query } from 'firebase/firestore';`,
  `import { doc, getDoc, setDoc, onSnapshot, getDocs, collection, limit, query, addDoc, serverTimestamp } from 'firebase/firestore';`
);

const userRefCode = `            await setDoc(userRef, newUserData);
            setUserData(newUserData as UserData);`;

const newCode = `            await setDoc(userRef, newUserData);
            setUserData(newUserData as UserData);
            
            // Send admin notification
            if (!isFirstUser) {
                try {
                    await addDoc(collection(db, 'notifications'), {
                        targetUid: 'admin',
                        type: 'signup',
                        message: \`New user signed up: \${currentUser.email}\`,
                        read: false,
                        createdAt: serverTimestamp()
                    });
                } catch (e) {
                    console.error("Failed to notify admin", e);
                }
            }`;

code = code.replace(userRefCode, newCode);
fs.writeFileSync('src/contexts/AuthContext.tsx', code);
