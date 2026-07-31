const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
    "const [filter, setFilter] = useState<'all' | 'uncompleted' | 'failed'>('all');",
    "const [filter, setFilter] = useState<'all' | 'ongoing' | 'uncompleted' | 'failed'>('all');"
);

const tabsTarget = `<button onClick={() => setFilter('all')} className={\`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}\`}>All ({items.length})</button>`;
const tabsReplacement = `<button onClick={() => setFilter('all')} className={\`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}\`}>All ({items.length})</button>
                          <button onClick={() => setFilter('ongoing')} className={\`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === 'ongoing' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}\`}>Ongoing ({items.filter(i => i.status === 'processing' || i.status === 'compressing').length})</button>`;
content = content.replace(tabsTarget, tabsReplacement);

const listTarget = `items={filter === 'failed' ? items.filter(i => i.status === 'error') : filter === 'uncompleted' ? items.filter(i => !i.title?.trim() || !i.keywords?.trim() || !i.category?.trim()) : items}`;
const listReplacement = `items={filter === 'failed' ? items.filter(i => i.status === 'error') : filter === 'uncompleted' ? items.filter(i => !i.title?.trim() || !i.keywords?.trim() || !i.category?.trim()) : filter === 'ongoing' ? items.filter(i => i.status === 'processing' || i.status === 'compressing') : items}`;
content = content.replace(listTarget, listReplacement);

fs.writeFileSync('src/App.tsx', content);
