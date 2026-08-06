const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const target = `<td className="py-4 text-slate-400 font-mono">
                          {user.totalProcessedImages || 0}
                        </td>`;

const replacement = `<td className="py-4 font-bold text-white">
                          {(user.totalProcessedImages || 0).toLocaleString()}
                        </td>
                        <td className="py-4 text-emerald-400 font-medium">
                          {avgPerDay.toLocaleString()}/d
                        </td>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
