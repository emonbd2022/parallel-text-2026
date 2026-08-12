const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

code = code.replace(
  `import { doc, setDoc, onSnapshot, serverTimestamp, addDoc, collection } from 'firebase/firestore';`,
  `import { doc, setDoc, getDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';`
);

code = code.replace(
  `interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
}`,
  `interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
}`
);

code = code.replace(
  `const AuthContext = createContext<AuthContextType>({ user: null, userData: null, loading: true });`,
  `const AuthContext = createContext<AuthContextType>({ user: null, userData: null, loading: true, setUserData: () => {} });`
);

const oldEffect = `          // Setup real-time listener for user data
          const unsubSnapshot = onSnapshot(userRef, async (docSnap) => {
            if (docSnap.exists()) {
              setUserData(docSnap.data() as UserData);
            } else {
              // Initialize user
              const isFirstUser = currentUser.email === 'titaniumfact97@gmail.com';
              const newUserData: Partial<UserData> = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                name: currentUser.displayName || '',
                photoURL: currentUser.photoURL || '',
                nickname: currentUser.displayName?.split(' ')[0] || 'User',
                credits: 100, // default credits
                unlimited: false,
                totalProcessedImages: 0,
                joinDate: new Date().toISOString(),
                blocked: false,
                role: isFirstUser ? 'admin' : 'user',
                plan: 'free',
              };
              
              await setDoc(userRef, newUserData);
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
              }
            }
          }, (err) => {
              console.error("Error listening to user data:", err);
          });
          
          if ((window as any)._userUnsub) {
              (window as any)._userUnsub();
          }
          (window as any)._userUnsub = unsubSnapshot;`;

const newEffect = `          const docSnap = await getDoc(userRef);
          if (docSnap.exists()) {
              setUserData(docSnap.data() as UserData);
          } else {
              // Initialize user
              const isFirstUser = currentUser.email === 'titaniumfact97@gmail.com';
              const newUserData: Partial<UserData> = {
                uid: currentUser.uid,
                email: currentUser.email || '',
                name: currentUser.displayName || '',
                photoURL: currentUser.photoURL || '',
                nickname: currentUser.displayName?.split(' ')[0] || 'User',
                credits: 100, // default credits
                unlimited: false,
                totalProcessedImages: 0,
                joinDate: new Date().toISOString(),
                blocked: false,
                role: isFirstUser ? 'admin' : 'user',
                plan: 'free',
              };
              
              await setDoc(userRef, newUserData);
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
              }
          }`;

code = code.replace(oldEffect, newEffect);

code = code.replace(
  `        if ((window as any)._userUnsub) {
            (window as any)._userUnsub();
            (window as any)._userUnsub = null;
        }`,
  ``
);

code = code.replace(
  `        if ((window as any)._userUnsub) {
            (window as any)._userUnsub();
            (window as any)._userUnsub = null;
        }`,
  ``
);

code = code.replace(
  `<AuthContext.Provider value={{ user, userData, loading }}>`,
  `<AuthContext.Provider value={{ user, userData, loading, setUserData }}>`
);

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
