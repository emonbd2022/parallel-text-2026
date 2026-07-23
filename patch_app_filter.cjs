const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add filter state
const stateTarget = `const [toasts, setToasts] = useState<Toast[]>([]);`;
const stateReplacement = `const [toasts, setToasts] = useState<Toast[]>([]);
    const [filter, setFilter] = useState<'all' | 'uncompleted'>('all');`;
content = content.replace(stateTarget, stateReplacement);

// Add the filter UI and modify ProcessingQueue props
const uiTarget = `                <ProcessingQueue 
                  items={items}`;

const uiReplacement = `                {items.length > 0 && (
                  <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
                      <div className="flex gap-2">
                          <button onClick={() => setFilter('all')} className={\`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}\`}>All ({items.length})</button>
                          <button onClick={() => setFilter('uncompleted')} className={\`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === 'uncompleted' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}\`}>Uncompleted ({items.filter(i => !i.title?.trim() || !i.keywords?.trim() || !i.category?.trim()).length})</button>
                      </div>
                  </div>
                )}

                <ProcessingQueue 
                  items={filter === 'uncompleted' ? items.filter(i => !i.title?.trim() || !i.keywords?.trim() || !i.category?.trim()) : items}`;
content = content.replace(uiTarget, uiReplacement);

fs.writeFileSync('src/App.tsx', content);
