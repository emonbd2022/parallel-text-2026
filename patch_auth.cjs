const fs = require('fs');
let code = fs.readFileSync('src/contexts/AuthContext.tsx', 'utf8');

const oldState = `  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);`;

const newState = `  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(() => {
    try {
      const cached = localStorage.getItem('cachedUserData');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userData) {
      localStorage.setItem('cachedUserData', JSON.stringify(userData));
    }
  }, [userData]);`;

code = code.replace(oldState, newState);

const oldFetch = `        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userRef);
          
          if (!docSnap.exists()) {`;

const newFetch = `        try {
          const userRef = doc(db, 'users', currentUser.uid);
          
          // Setup real-time listener for user data
          const unsubSnapshot = onSnapshot(userRef, async (docSnap) => {
            if (docSnap.exists()) {
              setUserData(docSnap.data() as UserData);
            } else {`;

code = code.replace(oldFetch, newFetch);

const oldInitEnd = `            // We need to clean this up, so store it.
            if ((window as any)._userUnsub) {
                (window as any)._userUnsub();
            }
            (window as any)._userUnsub = unsubSnapshot;
          }
        } catch (error) {`;

const newInitEnd = `          }
          }, (err) => {
              console.error("Error listening to user data:", err);
          });
          
          if ((window as any)._userUnsub) {
              (window as any)._userUnsub();
          }
          (window as any)._userUnsub = unsubSnapshot;

        } catch (error) {`;

code = code.replace(oldInitEnd, newInitEnd);

// Remove the getDoc version of the Else block since we use onSnapshot now
const oldElse = `          } else {
            // Set initial data
            setUserData(docSnap.data() as UserData);
            
            // Setup real-time listener for user data
            const unsubSnapshot = onSnapshot(userRef, (doc) => {
              if (doc.exists()) {
                setUserData(doc.data() as UserData);
              }
            }, (err) => {
                console.error("Error listening to user data:", err);
            });
            
            // We need to clean this up, so store it.
            if ((window as any)._userUnsub) {
                (window as any)._userUnsub();
            }
            (window as any)._userUnsub = unsubSnapshot;
          }`;
code = code.replace(oldElse, "");

fs.writeFileSync('src/contexts/AuthContext.tsx', code);
