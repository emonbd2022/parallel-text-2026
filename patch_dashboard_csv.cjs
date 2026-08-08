const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const oldFetch = `  useEffect(() => {
    if (!userData) return;
    const fetchExports = async () => {
      try {
        const q = query(
          collection(db, 'csv_exports'),
          where('uid', '==', userData.uid)
        );
        const snapshot = await getDocs(q);
        const exports: any[] = [];
        const now = new Date();
        const deletePromises: Promise<void>[] = [];
        
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.createdAt) {
            const createdAtDate = data.createdAt.toDate();
            const daysOld = (now.getTime() - createdAtDate.getTime()) / (1000 * 3600 * 24);
            if (daysOld <= 7) {
              exports.push({ id: docSnap.id, ...data });
            } else {
              deletePromises.push(deleteDoc(doc(db, 'csv_exports', docSnap.id)));
            }
          }
        });
        
        await Promise.all(deletePromises);
        exports.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
        setCsvExports(exports);
      } catch (err) {
        console.error("Error fetching exports:", err);
      } finally {
        setLoadingExports(false);
      }
    };
    fetchExports();
  }, [userData?.uid]);`;

const newFetch = `  useEffect(() => {
    if (!userData) return;
    const fetchExports = () => {
      try {
        const localExports = JSON.parse(localStorage.getItem('parrarel_exports_v1') || '[]');
        const userExports = localExports.filter((e: any) => e.uid === userData.uid);
        const now = new Date();
        
        const validExports = userExports.filter((data: any) => {
          if (data.createdAt) {
            const createdAtDate = new Date(data.createdAt);
            const daysOld = (now.getTime() - createdAtDate.getTime()) / (1000 * 3600 * 24);
            return daysOld <= 7;
          }
          return false;
        });
        
        // Update local storage if any were expired
        if (validExports.length !== localExports.length) {
            const otherUsersExports = localExports.filter((e: any) => e.uid !== userData.uid);
            localStorage.setItem('parrarel_exports_v1', JSON.stringify([...otherUsersExports, ...validExports]));
        }
        
        validExports.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCsvExports(validExports);
      } catch (err) {
        console.error("Error fetching exports:", err);
      } finally {
        setLoadingExports(false);
      }
    };
    fetchExports();
  }, [userData?.uid]);`;

code = code.replace(oldFetch, newFetch);

// Also change how the date is displayed in the map function
code = code.replace("exp.createdAt?.toDate().toLocaleString()", "new Date(exp.createdAt).toLocaleString()");

fs.writeFileSync('src/pages/Dashboard.tsx', code);
