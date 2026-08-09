const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldCloudLoad = `      if (userData.appData) {
        if (userData.appData.keys) setKeys(userData.appData.keys);
        if (userData.appData.config) setConfig(userData.appData.config);
        if (userData.appData.modelStats) setModelStats(userData.appData.modelStats);
        if (userData.appData.logs) setLogs(userData.appData.logs);
      }`;

const newCloudLoad = `      if (userData.appData) {
        if (userData.appData.keys) setKeys(userData.appData.keys);
        if (userData.appData.config) setConfig(userData.appData.config);
        if (userData.appData.modelStats) {
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
        }
      }`;

code = code.replace(oldCloudLoad, newCloudLoad);
fs.writeFileSync('src/App.tsx', code);
