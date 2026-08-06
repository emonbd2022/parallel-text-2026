const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Update imports
code = code.replace(
  `import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';`,
  `import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getAggregateFromServer, sum } from 'firebase/firestore';`
);

// Add state for pagination
code = code.replace(
  `const [totalSiteImages, setTotalSiteImages] = useState(0);`,
  `const [totalSiteImages, setTotalSiteImages] = useState(0);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);`
);

// Replace fetchUsers
const fetchUsersRegex = /const fetchUsers = async \(\) => \{[\s\S]*?finally \{\s*setLoading\(false\);\s*\}\s*\};\s*useEffect\(\(\) => \{\s*fetchUsers\(\);\s*\}, \[\]\);/;

const newFetchUsers = `
  const fetchTotalAggregate = async () => {
    try {
      const coll = collection(db, 'users');
      const snapshot = await getAggregateFromServer(coll, {
        totalImages: sum('totalProcessedImages')
      });
      setTotalSiteImages(snapshot.data().totalImages);
    } catch (e) {
      console.warn("Aggregate query failed", e);
    }
  };

  const fetchUsers = async (isNextPage = false) => {
    try {
      setLoading(true);
      let q = query(
        collection(db, 'users'), 
        orderBy('totalProcessedImages', 'desc'),
        limit(10)
      );
      
      if (isNextPage && lastVisible) {
        q = query(
          collection(db, 'users'),
          orderBy('totalProcessedImages', 'desc'),
          startAfter(lastVisible),
          limit(10)
        );
      } else if (!isNextPage) {
        setUsers([]);
        setPage(0);
      }

      const querySnapshot = await getDocs(q);
      const usersData: UserData[] = [];
      querySnapshot.forEach((d) => {
        usersData.push(d.data() as UserData);
      });

      if (querySnapshot.docs.length > 0) {
          setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }
      
      setHasMore(querySnapshot.docs.length >= 10);

      if (isNextPage) {
          setUsers(prev => {
              const newUsers = [...prev];
              usersData.forEach(u => {
                  if (!newUsers.find(x => x.uid === u.uid)) newUsers.push(u);
              });
              return newUsers;
          });
          setPage(p => p + 1);
      } else {
          setUsers(usersData);
          setPage(1);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTotalAggregate();
    fetchUsers(false);
  }, []);
`;

code = code.replace(fetchUsersRegex, newFetchUsers);

// Add Load More button at the end of the table
const tableEndRegex = /<\/tbody>\s*<\/table>\s*<\/div>/;
const newTableEnd = `</tbody>
            </table>
          </div>
          {hasMore && !searchTerm && (
            <div className="flex justify-center mt-6">
                <button 
                  onClick={() => fetchUsers(true)}
                  disabled={loading}
                  className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-sm text-slate-300 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Loading...' : 'Load More Users'}
                </button>
            </div>
          )}
`;

code = code.replace(tableEndRegex, newTableEnd);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
