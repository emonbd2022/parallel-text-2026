const fs = require('fs');
let code = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');

const target = `        {activeTab === 'keys' && (
          <button 
            onClick={() => setShowInput(!showInput)}
            className={\`text-xs font-semibold px-3 py-1.5 rounded-full transition-all \${`;

const replacement = `        {activeTab === 'keys' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={onResetAllKeys}
              className="text-xs font-semibold text-slate-100 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 px-3 py-1.5 rounded-full transition-colors"
              title="Reset all errors and cooldowns"
            >
              Reset All
            </button>
            <button 
              onClick={() => setShowInput(!showInput)}
              className={\`text-xs font-semibold px-3 py-1.5 rounded-full transition-all \${`;

code = code.replace(target, replacement);

// also replace the closing tags for the button container
const target2 = `            {showInput ? 'Cancel' : '+ Add Key'}
          </button>
        )}`;
const replacement2 = `            {showInput ? 'Cancel' : '+ Add Key'}
            </button>
          </div>
        )}`;
code = code.replace(target2, replacement2);

fs.writeFileSync('src/components/ApiKeyManager.tsx', code);
