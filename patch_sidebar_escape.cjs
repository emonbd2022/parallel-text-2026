const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const target = `<ul className="list-disc pl-4 space-y-1">
                        <li><code>{count}</code> - Number of items</li>
                        <li><code>{date}</code> - Current date (YYYY-MM-DD)</li>
                        <li><code>{time}</code> - Current time (HH-MM-SS)</li>
                      </ul>
                      <p className="mt-2 text-slate-400 italic">Example: project_x_{date}</p>`;

const replacement = `<ul className="list-disc pl-4 space-y-1">
                        <li><code>{"{count}"}</code> - Number of items</li>
                        <li><code>{"{date}"}</code> - Current date (YYYY-MM-DD)</li>
                        <li><code>{"{time}"}</code> - Current time (HH-MM-SS)</li>
                      </ul>
                      <p className="mt-2 text-slate-400 italic">Example: project_x_{"{date}"}</p>`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/Sidebar.tsx', content);
