const fs = require('fs');
let content = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');

const target = `        <button 
          onClick={() => setShowInput(!showInput)}
          className={\`text-xs font-semibold px-3 py-1.5 rounded-full transition-all \${
            showInput 
              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
              : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-900/50'
          }\`}
        >
          {showInput ? 'Cancel' : '+ Add Key'}
        </button>`;

const replacement = `        {activeTab === 'keys' && (
          <button 
            onClick={() => setShowInput(!showInput)}
            className={\`text-xs font-semibold px-3 py-1.5 rounded-full transition-all \${
              showInput 
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-900/50'
            }\`}
          >
            {showInput ? 'Cancel' : '+ Add Key'}
          </button>
        )}`;
content = content.replace(target, replacement);

fs.writeFileSync('src/components/ApiKeyManager.tsx', content);
