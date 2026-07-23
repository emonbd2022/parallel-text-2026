const fs = require('fs');
let content = fs.readFileSync('src/components/ProcessingQueue.tsx', 'utf8');

const CATEGORIES = [
    "Buildings and Architecture", "Business", "Drinks", "The Environment",
    "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure",
    "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers",
    "Culture and Religion", "Science", "Social Issues", "Sports", "Technology",
    "Transport", "Travel"
];

const idx = content.lastIndexOf('/>');
if (idx !== -1) {
    const insertIdx = content.indexOf('</div>', idx) + 6;
    
    const insertion = `

                      {/* Category Group */}
                      <div className="space-y-2 flex-1 flex flex-col">
                          <div className="flex justify-between items-end">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Category</label>
                          </div>
                          <select 
                            value={item.category || "Technology"}
                            onChange={(e) => onUpdate(item.id, 'category', e.target.value)}
                            disabled={item.status === 'processing' || item.status === 'compressing'}
                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3.5 text-sm text-slate-200 focus:border-purple-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all shadow-inner appearance-none"
                          >
                            ${CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('\n                            ')}
                          </select>
                      </div>`;

    content = content.substring(0, insertIdx) + insertion + content.substring(insertIdx);
    fs.writeFileSync('src/components/ProcessingQueue.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
