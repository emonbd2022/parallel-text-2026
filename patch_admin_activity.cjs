const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const dateEffectSearch = `  // Simplified calculation for processed in date range
  useEffect(() => {
    // In a real app we'd track processing logs with dates in Firestore.
    // For now we'll just mock the visual or assume totalProcessedImages if no logs.
    // Since we don't store per-date processed count globally, this is just a placeholder.
    if (startDate && endDate) {
       setDateRangeImages(0); // Needs backend aggregation
    } else {
       setDateRangeImages(totalSiteImages);
    }
  }, [startDate, endDate, totalSiteImages]);`;

const dateEffectReplace = `  useEffect(() => {
    const fetchDateRangeActivity = async () => {
        if (startDate && endDate) {
            try {
                // Ensure endDate includes the full day
                const endOfDay = new Date(endDate);
                endOfDay.setHours(23, 59, 59, 999);
                
                const q = query(
                    collection(db, 'activity_logs'),
                    where('timestamp', '>=', startDate),
                    where('timestamp', '<=', endOfDay)
                );
                const snapshot = await getAggregateFromServer(q, {
                    imagesProcessed: sum('imagesProcessed')
                });
                setDateRangeImages(snapshot.data().imagesProcessed || 0);
            } catch (error) {
                console.error("Error fetching date range activity:", error);
                setDateRangeImages(0);
            }
        } else {
            setDateRangeImages(totalSiteImages);
        }
    };
    fetchDateRangeActivity();
  }, [startDate, endDate, totalSiteImages]);`;

code = code.replace(dateEffectSearch, dateEffectReplace);
code = code.replace(
  `import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getAggregateFromServer, sum } from 'firebase/firestore';`,
  `import { collection, getDocs, updateDoc, doc, query, orderBy, limit, startAfter, getAggregateFromServer, sum, where } from 'firebase/firestore';`
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
