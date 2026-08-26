const fs = require('fs');

let content = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');

content = content.replace(
`  onResetAll?: () => void;
  onShowToast?: (title: string, message: string) => void;
}`,
`  onResetAll?: () => void;
  onShowToast?: (title: string, message: string) => void;
  onRefreshCentralKeys?: () => void;
}`);

content = content.replace(
`  onResetUsage, 
  onResetAll,
  onShowToast 
}) => {`,
`  onResetUsage, 
  onResetAll,
  onShowToast,
  onRefreshCentralKeys 
}) => {`);

fs.writeFileSync('src/components/ApiKeyManager.tsx', content);
