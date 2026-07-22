const fs = require('fs');
let content = fs.readFileSync('src/components/StatisticsModal.tsx', 'utf8');

const target1 = `    // 6. Processing Time Trend`;
const replacement1 = `    // 7. Hourly Performance Heatmap
    const heatmapData = useMemo(() => {
        const matrix = Array(24).fill(0).map(() => ({ totalMs: 0, count: 0, items: 0 }));
        sortedLogs.forEach(log => {
            const h = new Date(log.timestamp).getHours();
            matrix[h].totalMs += log.durationMs;
            matrix[h].count += log.itemCount;
            matrix[h].items += log.itemCount;
        });
        
        let minAvg = Infinity;
        let maxAvg = 0;
        const hours = matrix.map((h, i) => {
            const avg = h.count > 0 ? h.totalMs / h.count : 0;
            if (h.count > 0) {
                if (avg < minAvg) minAvg = avg;
                if (avg > maxAvg) maxAvg = avg;
            }
            return { hour: i, avg, items: h.items, hasData: h.count > 0 };
        });
        
        return { hours, minAvg, maxAvg };
    }, [sortedLogs]);

    // 6. Processing Time Trend`;

const target2 = `{/* Time of Day Chart */}`;
const replacement2 = `{/* 24-Hour Performance Heatmap */}
                    <div className="bg-slate-800/30 p-4 rounded-xl border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-200">24-Hour Performance Heatmap</h3>
                            <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500">
                                <span>Fast</span>
                                <div className="flex gap-1">
                                    <div className="w-3 h-3 rounded bg-emerald-500" />
                                    <div className="w-3 h-3 rounded bg-amber-500" />
                                    <div className="w-3 h-3 rounded bg-red-500" />
                                </div>
                                <span>Slow</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-24 gap-1 h-24">
                            {heatmapData.hours.map((h) => {
                                let colorClass = "bg-slate-800";
                                if (h.hasData) {
                                    // simple thresholding based on ms per item
                                    const avgSec = h.avg / 1000;
                                    if (avgSec < 4) colorClass = "bg-emerald-500";
                                    else if (avgSec < 8) colorClass = "bg-amber-500";
                                    else colorClass = "bg-red-500";
                                }
                                return (
                                    <div 
                                        key={h.hour} 
                                        className={\`relative group rounded-sm \${colorClass} transition-opacity hover:opacity-80\`}
                                        style={{ height: '100%' }}
                                    >
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-max bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs shadow-xl pointer-events-none">
                                            <p className="font-bold text-slate-200 mb-1">{h.hour}:00 - {h.hour}:59</p>
                                            {h.hasData ? (
                                                <>
                                                    <p className="text-slate-400">Avg Time: <span className="text-white font-mono">{(h.avg / 1000).toFixed(1)}s</span> / item</p>
                                                    <p className="text-slate-400">Volume: <span className="text-white font-mono">{h.items}</span> items</p>
                                                </>
                                            ) : (
                                                <p className="text-slate-500">No data</p>
                                            )}
                                        </div>
                                        {/* Label at bottom for some hours */}
                                        {h.hour % 4 === 0 && (
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[10px] text-slate-500 font-mono">
                                                {h.hour}h
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-6 text-xs text-slate-400 text-center">
                            Highlighting peak performance hours to optimize large batch processing.
                        </div>
                    </div>

                    {/* Time of Day Chart */}`;

if (content.includes(target1) && content.includes(target2)) {
    content = content.replace(target1, replacement1);
    content = content.replace(target2, replacement2);
    // Note: Tailwind config might not have grid-cols-24 by default, we can just use flex or style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}
    // Let me update the grid line.
    content = content.replace('className="grid grid-cols-24 gap-1 h-24"', 'className="grid gap-1 h-24" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}');
    fs.writeFileSync('src/components/StatisticsModal.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
