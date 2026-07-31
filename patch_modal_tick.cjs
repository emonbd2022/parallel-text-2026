const fs = require('fs');
let content = fs.readFileSync('src/components/StatisticsModal.tsx', 'utf8');

if (!content.includes('import React, { useState, useMemo, useEffect }')) {
    content = content.replace("import React, { useState, useMemo }", "import React, { useState, useMemo, useEffect }");
}

const target = `    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    // Ensure logs are sorted`;

const replacement = `    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [tick, setTick] = useState(0);

    // Auto-refresh data while modal is open
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    // Ensure logs are sorted`;

content = content.replace(target, replacement);

const targetLogs = `    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());`;
const replacementLogs = `    const sortedLogs = useMemo(() => [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()), [logs]);`;
content = content.replace(targetLogs, replacementLogs);

fs.writeFileSync('src/components/StatisticsModal.tsx', content);
