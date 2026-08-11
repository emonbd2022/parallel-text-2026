const fs = require('fs');

// Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');

const handleResetAllKeys = `
  const handleResetAllKeys = () => {
      if (window.confirm('Are you sure you want to manually reset usage, errors, and cooldowns for ALL keys?')) {
          const currentSession = getUsageSessionId();
          setKeys(prev => prev.map(k => ({
              ...k,
              errorCount: 0,
              cooldownUntil: undefined,
              usage: { date: currentSession, flash: 0, lite: 0, pro: 0, flash_3: 0, flash_3_1_lite: 0, flash_3_5: 0, flash_3_5_lite: 0, flash_3_6: 0 }
          })));
      }
  };
`;
// Insert before handleResetUsage
appCode = appCode.replace('const handleResetUsage = (id: string) => {', handleResetAllKeys + '\n  const handleResetUsage = (id: string) => {');
appCode = appCode.replace('onResetUsage={handleResetUsage}', 'onResetUsage={handleResetUsage}\n         onResetAllKeys={handleResetAllKeys}');
appCode = appCode.replace('errorCount: 0, // Reset errors too', 'errorCount: 0, // Reset errors too\n                      cooldownUntil: undefined,');
fs.writeFileSync('src/App.tsx', appCode);

// Patch Sidebar.tsx
let sidebarCode = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
sidebarCode = sidebarCode.replace('onResetUsage: (id: string) => void;', 'onResetUsage: (id: string) => void;\n  onResetAllKeys: () => void;');
sidebarCode = sidebarCode.replace('onResetUsage={onResetUsage}', 'onResetUsage={onResetUsage}\n                onResetAllKeys={onResetAllKeys}');
sidebarCode = sidebarCode.replace('onResetUsage,', 'onResetUsage,\n  onResetAllKeys,');
fs.writeFileSync('src/components/Sidebar.tsx', sidebarCode);

// Patch ApiKeyManager.tsx
let managerCode = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');
managerCode = managerCode.replace('onResetUsage: (id: string) => void;', 'onResetUsage: (id: string) => void;\n  onResetAllKeys: () => void;');
managerCode = managerCode.replace('onResetUsage }) => {', 'onResetUsage, onResetAllKeys }) => {');

const masterButton = `
        <div className="flex gap-4 items-center">
          <button 
             onClick={() => setActiveTab('keys')}
`;
managerCode = managerCode.replace('<div className="flex gap-4 items-center">\n          <button \n             onClick={() => setActiveTab(\'keys\')}', `
        <div className="flex gap-4 items-center">
          <button
            onClick={onResetAllKeys}
            className="text-xs font-semibold text-slate-100 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 px-2 py-1 rounded transition-colors"
            title="Reset all errors and cooldowns"
          >
            RESET ALL
          </button>
          <button 
             onClick={() => setActiveTab('keys')}
`);
fs.writeFileSync('src/components/ApiKeyManager.tsx', managerCode);
