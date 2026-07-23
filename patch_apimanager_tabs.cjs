const fs = require('fs');
let content = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');

// Add activeTab state
const stateTarget = `const [now, setNow] = useState(Date.now());`;
const stateReplacement = `const [now, setNow] = useState(Date.now());
  const [activeTab, setActiveTab] = useState<'keys' | 'health'>('keys');`;
content = content.replace(stateTarget, stateReplacement);

// Update Header
const headerTarget = `<h3 className="text-lg font-bold text-slate-100">API Keys</h3>`;
const headerReplacement = `<div className="flex gap-4 items-center">
          <button 
            onClick={() => setActiveTab('keys')}
            className={\`text-lg font-bold transition-colors \${activeTab === 'keys' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}\`}
          >
            API Keys
          </button>
          <button 
            onClick={() => setActiveTab('health')}
            className={\`text-lg font-bold transition-colors \${activeTab === 'health' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}\`}
          >
            Health Status
          </button>
        </div>`;
content = content.replace(headerTarget, headerReplacement);

// Find keys rendering section and hide it if activeTab is not keys
const inputTarget = `{showInput && (`;
const inputReplacement = `{activeTab === 'keys' && showInput && (`;
content = content.replace(inputTarget, inputReplacement);

const keysListTarget = `<div className="space-y-2 max-h-52 overflow-y-auto pr-2 custom-scrollbar">`;
const keysListReplacement = `{activeTab === 'keys' && (
      <div className="space-y-2 max-h-52 overflow-y-auto pr-2 custom-scrollbar">`;
content = content.replace(keysListTarget, keysListReplacement);

const keysListEndTarget = `      </div>

      {/* API Key Health Status */}`;
const keysListEndReplacement = `      </div>
      )}

      {/* API Key Health Status */}`;
content = content.replace(keysListEndTarget, keysListEndReplacement);


// Find Health Status section and hide it if activeTab is not health
const healthTarget = `{keys.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
              <h3 className="text-xs uppercase font-bold text-slate-500 mb-3 pl-1">API Key Health Status</h3>`;
const healthReplacement = `{activeTab === 'health' && keys.length > 0 && (
          <div className="mt-4 pt-2">`;
content = content.replace(healthTarget, healthReplacement);

fs.writeFileSync('src/components/ApiKeyManager.tsx', content);
