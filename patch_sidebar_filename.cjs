const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const target = `                {/* Export Type */}`;
const replacement = `                {/* Custom Export Filename */}
                <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 pl-1">Export CSV Filename</label>
                <div className="relative group/tooltip">
                    <input 
                    type="text" 
                    value={config.exportFilenameTemplate || ''} 
                    onChange={(e) => setConfig(prev => ({ ...prev, exportFilenameTemplate: e.target.value }))}
                    placeholder="{count}items_{date}"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-purple-500 outline-none placeholder:text-slate-600"
                    />
                    <div className="absolute hidden group-hover/tooltip:block top-full mt-2 left-0 w-64 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-xl text-xs text-slate-300 z-50 pointer-events-none">
                      <p className="font-bold text-white mb-1">Available Tags:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li><code>{count}</code> - Number of items</li>
                        <li><code>{date}</code> - Current date (YYYY-MM-DD)</li>
                        <li><code>{time}</code> - Current time (HH-MM-SS)</li>
                      </ul>
                      <p className="mt-2 text-slate-400 italic">Example: project_x_{date}</p>
                    </div>
                </div>
                </div>

                {/* Export Type */}`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/Sidebar.tsx', content);
