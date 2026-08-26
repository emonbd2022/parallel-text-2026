const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
`         onResetAll={handleResetAllUsage}
         onShowToast={showNotification}
      />`,
`         onResetAll={handleResetAllUsage}
         onShowToast={showNotification}
         onRefreshCentralKeys={() => fetchCentralKeysPool(true)}
      />`);

fs.writeFileSync('src/App.tsx', content);
