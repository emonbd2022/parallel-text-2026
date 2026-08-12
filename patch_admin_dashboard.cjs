const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const oldEffect = `  useEffect(() => {
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

const newEffect = `  useEffect(() => {
    setDateRangeImages(totalSiteImages);
  }, [startDate, endDate, totalSiteImages]);`;

code = code.replace(oldEffect, newEffect);

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
