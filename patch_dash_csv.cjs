const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const oldCode = `    const fetchExports = () => {
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
        if (validExports.length !== userExports.length) {
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
    fetchExports();`;

const newCode = `    const fetchExports = async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 7);
        const q = query(
            collection(db, 'csv_exports'),
            where('uid', '==', userData.uid)
        );
        const snapshot = await getDocs(q);
        const userExports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        const validExports = userExports.filter(e => {
            const date = new Date(e.createdAt);
            return date > thirtyDaysAgo;
        });
        
        validExports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCsvExports(validExports);
      } catch (err) {
        console.error("Error fetching exports:", err);
      } finally {
        setLoadingExports(false);
      }
    };
    fetchExports();`;

code = code.replace(oldCode, newCode);

if (!code.includes('collection,')) {
    code = code.replace(/import { doc, getDoc } from 'firebase\/firestore';/, "import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';");
}

fs.writeFileSync('src/pages/Dashboard.tsx', code);
