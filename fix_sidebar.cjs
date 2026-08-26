const fs = require('fs');

let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

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

content = content.replace(
`<ApiKeyManager 
                apiMode={config.apiMode || 'local'}`,
`<ApiKeyManager 
                onRefreshCentralKeys={onRefreshCentralKeys}
                apiMode={config.apiMode || 'local'}`);

fs.writeFileSync('src/components/Sidebar.tsx', content);
