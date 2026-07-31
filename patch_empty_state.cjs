const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetUpload = `             <div 
                  className="group relative border-2 border-dashed border-slate-800 bg-slate-900/20 hover:bg-slate-900/40 hover:border-purple-500/30 transition-all duration-300 rounded-3xl p-8 text-center cursor-pointer overflow-hidden min-h-[200px] flex flex-col items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('fileInput')?.click();
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <input id="fileInput" type="file" multiple accept="image/*,.eps,.svg" className="hidden" onChange={(e) => handleAddFiles(e.target.files)} />
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="p-4 bg-slate-800 rounded-full text-purple-400 shadow-xl group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/10">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-slate-200">Upload Images</p>
                      <p className="text-sm text-slate-500">JPG, PNG, WEBP, SVG, EPS</p>
                    </div>
                  </div>
                </div>`;

const replacementUpload = `             <div 
                  className="group relative border-2 border-dashed border-slate-700/50 hover:border-purple-500/50 bg-slate-900/20 hover:bg-slate-900/50 transition-all duration-500 rounded-[2rem] p-12 text-center cursor-pointer overflow-hidden min-h-[300px] flex flex-col items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById('fileInput')?.click();
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <input id="fileInput" type="file" multiple accept="image/*,.eps,.svg" className="hidden" onChange={(e) => handleAddFiles(e.target.files)} />
                  
                  <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="relative mt-4">
                      <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-150 animate-pulse delay-75"></div>
                      <div className="relative p-6 bg-slate-800/80 backdrop-blur-sm rounded-3xl text-blue-400 shadow-2xl shadow-blue-900/20 group-hover:-translate-y-2 transition-all duration-500 border border-white/5 flex items-center justify-center">
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                           <path d="M12 13v8"/>
                           <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
                           <path d="m8 17 4-4 4 4"/>
                        </svg>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[20%] flex gap-3 pointer-events-none group-hover:animate-bounce">
                           <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_white]"></div>
                           <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_white]"></div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-100 mb-2">Drop your creativity here</h3>
                      <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                        Drag and drop your images to automatically generate Adobe Stock-ready titles, keywords, and categories. 
                        <br/><span className="text-xs text-slate-500 mt-2 block font-medium">Supports JPG, PNG, WEBP, SVG, EPS</span>
                      </p>
                    </div>
                  </div>
                </div>`;

content = content.replace(targetUpload, replacementUpload);
fs.writeFileSync('src/App.tsx', content);
