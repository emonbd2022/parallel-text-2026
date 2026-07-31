const fs = require('fs');
let content = fs.readFileSync('src/components/StatisticsModal.tsx', 'utf8');

content = content.replace("    }, [sortedLogs]);", "    }, [sortedLogs, tick]);");
// Do this for all of them, but wait, some are [sortedLogs, dateRange] etc.
content = content.replace("    }, [sortedLogs, dateRange]);", "    }, [sortedLogs, dateRange, tick]);");
content = content.replace("    }, [modelStats, models]);", "    }, [modelStats, models, tick]);");

fs.writeFileSync('src/components/StatisticsModal.tsx', content);
