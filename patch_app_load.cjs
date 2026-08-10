const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldLoad = `        if (userData.appData.modelStats) {
            setModelStats(prev => {
                const merged = { ...prev };
                const serverStats = userData.appData.modelStats;
                for (const model in serverStats) {
                    if (merged[model]) {
                        merged[model] = {
                            count: merged[model].count + serverStats[model].count,
                            fails: merged[model].fails + serverStats[model].fails,
                            totalTimeMs: merged[model].totalTimeMs + serverStats[model].totalTimeMs
                        };
                    } else {
                        merged[model] = serverStats[model];
                    }
                }
                return merged;
            });
        }
        if (userData.appData.logs) {
            setLogs(prev => {
                const merged = [...prev, ...userData.appData.logs].sort((a, b) => b.timestamp - a.timestamp);
                // deduplicate by id
                const unique = [];
                const ids = new Set();
                for (const log of merged) {
                    if (!ids.has(log.id)) {
                        ids.add(log.id);
                        unique.push(log);
                    }
                }
                return unique.slice(0, 1000); // keep last 1000 logs
            });
        }`;

const newLoad = `        if (userData.appData.modelStats) {
            setModelStats(prev => {
                const merged = { ...prev };
                const serverStats = userData.appData.modelStats;
                for (const model in serverStats) {
                    if (merged[model]) {
                        merged[model] = {
                            count: Math.max(merged[model].count, serverStats[model].count),
                            fails: Math.max(merged[model].fails, serverStats[model].fails),
                            totalTimeMs: Math.max(merged[model].totalTimeMs, serverStats[model].totalTimeMs)
                        };
                    } else {
                        merged[model] = serverStats[model];
                    }
                }
                return merged;
            });
        }
        if (userData.appData.logs) {
            setLogs(prev => {
                const merged = [...prev, ...userData.appData.logs].sort((a, b) => b.timestamp - a.timestamp);
                // deduplicate by id
                const unique = [];
                const ids = new Set();
                for (const log of merged) {
                    if (!ids.has(log.id)) {
                        ids.add(log.id);
                        unique.push(log);
                    }
                }
                return unique.slice(0, 1000); // keep last 1000 logs
            });
        }
        if (userData.appData.history) {
            setHistory(prev => {
                const merged = [...prev, ...userData.appData.history];
                // deduplicate by id
                const unique = [];
                const ids = new Set();
                for (const h of merged) {
                    if (!ids.has(h.id)) {
                        ids.add(h.id);
                        unique.push(h);
                    }
                }
                return unique.sort((a, b) => b.timestamp - a.timestamp);
            });
        }`;

code = code.replace(oldLoad, newLoad);
fs.writeFileSync('src/App.tsx', code);
