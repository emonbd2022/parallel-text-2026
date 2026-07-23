const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const regex = /\{\/\* API Key Health Status \*\/\}[\s\S]*?\)\}\s+<div className="glass-panel p-6 rounded-2xl space-y-6">/g;

const replacement = `<div className="glass-panel p-6 rounded-2xl space-y-6">`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/components/Sidebar.tsx', content);
    console.log("Success Sidebar");
} else {
    console.log("Target not found in Sidebar!");
}

let apiContent = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');
const apiRegex = /<\/div>\s+<\/div>\s+\);\s+\};/g;

const apiReplacement = `      </div>

      {/* API Key Health Status */}
      {keys.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
              <h3 className="text-xs uppercase font-bold text-slate-500 mb-3 pl-1">API Key Health Status</h3>
              <div className="space-y-3">
                  {keys.map(k => {
                      const totalSuccess = Object.keys(k.usage).reduce((acc, key) => {
                          if (key !== 'date' && typeof (k.usage)[key] === 'number') {
                              return acc + (k.usage)[key];
                          }
                          return acc;
                      }, 0);
                      const totalAttempts = totalSuccess + k.errorCount;
                      const successRate = totalAttempts > 0 ? (totalSuccess / totalAttempts) * 100 : 100;
                      const health = Math.max(0, Math.min(100, successRate - (k.errorCount > 0 ? (k.errorCount / 20) * 100 : 0))); // penalize heavily for raw error count
                      
                      const isDead = k.errorCount >= 20;
                      let colorClass = "bg-emerald-500";
                      if (isDead) colorClass = "bg-red-600";
                      else if (health < 50) colorClass = "bg-red-500";
                      else if (health < 80) colorClass = "bg-amber-500";

                      return (
                          <div key={k.id} className="text-sm">
                              <div className="flex justify-between items-center mb-1 px-1 text-xs">
                                  <span className={\`font-medium truncate max-w-[120px] \${isDead ? 'text-red-400' : 'text-slate-300'}\`} title={k.label}>{k.label}</span>
                                  <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-500 font-mono" title="Errors">
                                          {k.errorCount} err
                                      </span>
                                      <span className={\`font-mono \${health >= 80 ? 'text-emerald-400' : health >= 50 ? 'text-amber-400' : 'text-red-400'}\`}>
                                          {isDead ? 'DEAD' : \`\${health.toFixed(0)}%\`}
                                      </span>
                                  </div>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                      className={\`h-full rounded-full transition-all duration-500 \${colorClass}\`}
                                      style={{ width: \`\${isDead ? 100 : health}%\` }}
                                  />
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

    </div>
  );
};`;

if (apiRegex.test(apiContent)) {
    apiContent = apiContent.replace(apiRegex, apiReplacement);
    fs.writeFileSync('src/components/ApiKeyManager.tsx', apiContent);
    console.log("Success ApiKeyManager");
} else {
    console.log("Target not found in ApiKeyManager!");
}
