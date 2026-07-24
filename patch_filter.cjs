const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Filter state type
content = content.replace(
  /const \[filter, setFilter\] = useState\<'all' \| 'uncompleted'\>\('all'\);/,
  "const [filter, setFilter] = useState<'all' | 'uncompleted' | 'failed'>('all');\n  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);"
);

// 2. Filter logic and buttons
const oldFilterButtons = `<button onClick={() => setFilter('all')} className={\`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}\`}>All ({items.length})</button>
                          <button onClick={() => setFilter('uncompleted')} className={\`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === 'uncompleted' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}\`}>Uncompleted ({items.filter(i => !i.title?.trim() || !i.keywords?.trim() || !i.category?.trim()).length})</button>`;
                          
const newFilterButtons = `<button onClick={() => setFilter('all')} className={\`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}\`}>All ({items.length})</button>
                          <button onClick={() => setFilter('uncompleted')} className={\`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === 'uncompleted' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}\`}>Uncompleted ({items.filter(i => !i.title?.trim() || !i.keywords?.trim() || !i.category?.trim()).length})</button>
                          <button onClick={() => setFilter('failed')} className={\`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors \${filter === 'failed' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}\`}>Failed ({items.filter(i => i.status === 'error').length})</button>`;
content = content.replace(oldFilterButtons, newFilterButtons);

const oldFilterList = `items={filter === 'uncompleted' ? items.filter(i => !i.title?.trim() || !i.keywords?.trim() || !i.category?.trim()) : items}`;
const newFilterList = `items={filter === 'failed' ? items.filter(i => i.status === 'error') : filter === 'uncompleted' ? items.filter(i => !i.title?.trim() || !i.keywords?.trim() || !i.category?.trim()) : items}`;
content = content.replace(oldFilterList, newFilterList);

// 3. Auto Scroll checkbox logic
content = content.replace(
  /if \(!isProcessing\) return;\n    if \(Date\.now\(\) - lastUserScrollRef\.current < 2000\) return;/g,
  "if (!isProcessing || !autoScrollEnabled) return;\n    if (Date.now() - lastUserScrollRef.current < 2000) return;"
);

// Add the checkbox to the UI
const autoScrollCheckbox = `
               <label className="flex items-center gap-1.5 ml-4 cursor-pointer">
                 <input type="checkbox" checked={autoScrollEnabled} onChange={(e) => setAutoScrollEnabled(e.target.checked)} className="rounded bg-slate-800 border-slate-600 text-purple-500 focus:ring-purple-500" />
                 <span className="text-xs text-slate-400">Auto-scroll</span>
               </label>`;

// Insert the checkbox after the help tooltip in the header
const titleHeaderRegex = /<h2 className="text-xl font-bold text-white flex items-center gap-2">[\s\S]*?<\/h2>/;
content = content.replace(titleHeaderRegex, (match) => {
    return match + autoScrollCheckbox;
});

// Update the tooltip position
content = content.replace(
    /bottom-full mb-2 left-0 md:left-1\/2 md:-translate-x-1\/2/,
    "top-full mt-2 left-0 md:left-0"
);

fs.writeFileSync('src/App.tsx', content);
