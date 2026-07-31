const fs = require('fs');
let content = fs.readFileSync('src/components/StatisticsModal.tsx', 'utf8');

if (!content.includes('import { useState }')) {
    content = content.replace("import { ResponsiveContainer", "import { useState } from 'react';\nimport { ResponsiveContainer");
}

const targetComp = `export const StatisticsModal = ({ logs, modelStats, models, onClose }: StatisticsModalProps) => {`;
const replacementComp = `export const StatisticsModal = ({ logs, modelStats, models, onClose }: StatisticsModalProps) => {
    const [isListExpanded, setIsListExpanded] = useState(false);`;
content = content.replace(targetComp, replacementComp);

const targetRender = `                    {/* Model Performance Summary */}`;
const replacementRender = `                    {/* Individual Logs Expandable List */}
                    <div className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden">
                        <button 
                            onClick={() => setIsListExpanded(!isListExpanded)}
                            className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors text-left"
                        >
                            <h3 className="font-semibold text-slate-200">Individual Processing Times</h3>
                            <svg className={\`w-5 h-5 text-slate-400 transition-transform \${isListExpanded ? 'rotate-180' : ''}\`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                        {isListExpanded && (
                            <div className="p-4 pt-0 border-t border-white/5 max-h-64 overflow-y-auto">
                                {logs.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic text-center py-4">No processing logs available.</p>
                                ) : (
                                    <div className="space-y-2 mt-2">
                                        {[...logs].reverse().map((log) => (
                                            <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-700/50 text-sm">
                                                <div className="text-slate-400">
                                                    <span className="text-slate-300">{new Date(log.timestamp).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-slate-400"><span className="text-slate-200">{log.itemCount}</span> items</span>
                                                    <span className="font-mono text-emerald-400">{(log.durationMs / 1000).toFixed(1)}s</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Model Performance Summary */}`;

content = content.replace(targetRender, replacementRender);

fs.writeFileSync('src/components/StatisticsModal.tsx', content);
