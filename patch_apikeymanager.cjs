const fs = require('fs');
let code = fs.readFileSync('src/components/ApiKeyManager.tsx', 'utf8');

const oldTabs = `          <button 
            onClick={() => setActiveTab('health')}
            className={\`text-lg font-bold transition-colors \${activeTab === 'health' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}\`}
          >
            Health Status
          </button>
        </div>`;

const newTabs = `          <button 
            onClick={() => setActiveTab('health')}
            className={\`text-lg font-bold transition-colors \${activeTab === 'health' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}\`}
          >
            Health Status
          </button>
          <button 
            onClick={() => setActiveTab('routing')}
            className={\`text-lg font-bold transition-colors \${activeTab === 'routing' ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'}\`}
          >
            Routing
          </button>
        </div>`;

code = code.replace(oldTabs, newTabs);

const oldActiveTabType = `const [activeTab, setActiveTab] = useState<'keys' | 'health'>('keys');`;
const newActiveTabType = `const [activeTab, setActiveTab] = useState<'keys' | 'health' | 'routing'>('keys');`;
code = code.replace(oldActiveTabType, newActiveTabType);

const oldEndOfComponent = `      {/* API Key Health Status */}`;

const newRoutingTab = `      {/* API Key Routing Status */}
      {activeTab === 'routing' && (
          <div className="mt-4 pt-2">
              <div className="space-y-4">
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <h4 className="font-bold text-sm text-slate-300 mb-2">TITLE / KEYWORD PREFERRED POOL ({Math.ceil(keys.length / 2)} keys)</h4>
                      <ul className="text-xs space-y-1">
                          {keys.slice(0, Math.ceil(keys.length / 2)).map(k => (
                              <li key={k.id} className="flex justify-between">
                                  <span className="text-slate-400">{k.label}</span>
                                  <span className={k.errorCount >= 20 ? 'text-red-400' : (k.cooldownUntil && k.cooldownUntil > now) ? 'text-amber-400' : 'text-emerald-400'}>
                                      {k.errorCount >= 20 ? 'Failed' : (k.cooldownUntil && k.cooldownUntil > now) ? 'Cooldown' : 'Healthy'}
                                  </span>
                              </li>
                          ))}
                      </ul>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <h4 className="font-bold text-sm text-slate-300 mb-2">CATEGORY PREFERRED POOL ({Math.floor(keys.length / 2)} keys)</h4>
                      <ul className="text-xs space-y-1">
                          {keys.slice(Math.ceil(keys.length / 2)).map(k => (
                              <li key={k.id} className="flex justify-between">
                                  <span className="text-slate-400">{k.label}</span>
                                  <span className={k.errorCount >= 20 ? 'text-red-400' : (k.cooldownUntil && k.cooldownUntil > now) ? 'text-amber-400' : 'text-emerald-400'}>
                                      {k.errorCount >= 20 ? 'Failed' : (k.cooldownUntil && k.cooldownUntil > now) ? 'Cooldown' : 'Healthy'}
                                  </span>
                              </li>
                          ))}
                      </ul>
                  </div>
                  <p className="text-xs text-slate-500 italic mt-2">Global Fallback: ENABLED (Healthy keys will process any task if its preferred pool is exhausted)</p>
              </div>
          </div>
      )}

      {/* API Key Health Status */}`;

code = code.replace(oldEndOfComponent, newRoutingTab);
fs.writeFileSync('src/components/ApiKeyManager.tsx', code);
