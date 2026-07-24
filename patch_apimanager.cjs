const fs = require('fs');
let content = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');

// Remove health progress bar from 'keys' tab
const healthBarKeys = `                {/* Health Progress Bar */}
                <div className="w-full h-1 mt-1.5 bg-slate-800 rounded-full overflow-hidden flex items-center">
                    <div 
                        className={\`h-full rounded-full transition-all duration-500 \${health >= 80 ? 'bg-emerald-500' : health >= 50 ? 'bg-amber-500' : 'bg-red-500'}\`}
                        style={{ width: \`\${health}%\` }}
                        title={\`Recent health trend: \${health}%\`}
                    />
                </div>`;
content = content.replace(healthBarKeys, "");

// Add count to the "API Keys" text or tab
content = content.replace(
  `API Keys`,
  `API Keys (\${keys.length})`
);

// We need to add "Lifetime generations: X" in health tab
const totalSuccessStat = `const totalSuccess = Object.values(u).reduce((sum, val) => typeof val === 'number' ? sum + val : sum, 0);`;
// In the Health tab loop
const totalSuccessDiv = `<div className="mt-1 mb-2">
                                  <span className="text-xs text-slate-400">Total Lifetime: {totalSuccess}</span>
                              </div>`;
const replaceTarget = `                              <div className="flex justify-between items-end mb-2">
                                  <div className="text-xs text-slate-500">`;
content = content.replace(replaceTarget, totalSuccessDiv + `\n                              <div className="flex justify-between items-end mb-2">\n                                  <div className="text-xs text-slate-500">`);

fs.writeFileSync('src/components/ApiKeyManager.tsx', content);
