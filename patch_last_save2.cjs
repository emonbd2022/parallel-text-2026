const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `              <div className="flex flex-col justify-center items-center">
                <button 
                  id="save-btn"
                  type="button"
                  onClick={handleSaveProject}
                  disabled={items.length === 0}
                  title="Save Project (Ctrl+S / Cmd+S)"
                  className="px-4 py-2 bg-slate-800 hover:bg-purple-900/40 text-slate-300 hover:text-purple-400 rounded-lg transition-all font-semibold border border-white/5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Project
                </button>
                {lastAutoSave && (
                  <span className="text-[10px] text-slate-500 absolute mt-10 pointer-events-none">
                    Last saved: {lastAutoSave.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>`;
const replacement = `              <div className="relative flex flex-col justify-center items-center group">
                <button 
                  id="save-btn"
                  type="button"
                  onClick={handleSaveProject}
                  disabled={items.length === 0}
                  title="Save Project (Ctrl+S / Cmd+S)"
                  className="px-4 py-2 bg-slate-800 hover:bg-purple-900/40 text-slate-300 hover:text-purple-400 rounded-lg transition-all font-semibold border border-white/5 text-sm disabled:opacity-50 disabled:cursor-not-allowed relative"
                >
                  Save Project
                </button>
                {lastAutoSave && (
                  <span className="text-[10px] text-slate-500 absolute -bottom-5 whitespace-nowrap pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                    Last saved: {lastAutoSave.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>`;
content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
