const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

content = content.replace(
  "setLogs(JSON.parse(localStorage.getItem('parrarel_logs_v1') || '[]'));",
  "setLogs(userData?.appData?.logs || JSON.parse(localStorage.getItem('parrarel_logs_v1') || '[]'));"
);

content = content.replace(
  "setModelStats(JSON.parse(localStorage.getItem('parrarel_stats_v1') || '{}'));",
  "setModelStats(userData?.appData?.modelStats || JSON.parse(localStorage.getItem('parrarel_stats_v1') || '{}'));"
);

// We need to add userData as dependency
content = content.replace(
  "  }, []);",
  "  }, [userData]);"
);

fs.writeFileSync('src/pages/Dashboard.tsx', content);
