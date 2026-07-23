const fs = require('fs');
let content = fs.readFileSync('src/components/ProcessingQueue.tsx', 'utf8');

const regex = /<select\s+value=\{item\.category \|\| "Technology"\}\s+onChange=\{\(e\) => onUpdate\(item\.id, 'category', e\.target\.value\)\}\s+disabled=\{item\.status === 'processing' \|\| item\.status === 'compressing'\}\s+className="w-full bg-slate-900\/50 border border-slate-700\/50 rounded-xl px-4 py-3\.5 text-sm text-slate-200 focus:border-purple-500\/50 focus:bg-slate-900 focus:ring-1 focus:ring-purple-500\/50 outline-none transition-all shadow-inner appearance-none"\s+>/;

const replacement = `<select 
                            value={item.category || ""}
                            onChange={(e) => onUpdate(item.id, 'category', e.target.value)}
                            disabled={item.status === 'processing' || item.status === 'compressing'}
                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm text-slate-200 focus:border-purple-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all shadow-inner appearance-none"
                          >
                            <option value="">Select a category...</option>
                            <option value="Animals">Animals</option>`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/components/ProcessingQueue.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
