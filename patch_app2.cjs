const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Remove the individual useEffects
content = content.replace("useEffect(() => { localStorage.setItem(STORAGE_KEYS, JSON.stringify(keys)); if (cloudLoaded && userData) syncUserDataToCloud(userData.uid, { keys, config, modelStats, logs }); }, [keys, cloudLoaded, userData]);\n", "");
content = content.replace("useEffect(() => localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history)), [history]);\n", "");
content = content.replace("useEffect(() => { localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs)); if (cloudLoaded && userData) syncUserDataToCloud(userData.uid, { keys, config, modelStats, logs }); }, [logs, cloudLoaded, userData]);\n", "");
content = content.replace("useEffect(() => { localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config)); if (cloudLoaded && userData) syncUserDataToCloud(userData.uid, { keys, config, modelStats, logs }); }, [config, cloudLoaded, userData]);\n", "");
content = content.replace("useEffect(() => { localStorage.setItem(STORAGE_STATS, JSON.stringify(modelStats)); if (cloudLoaded && userData) syncUserDataToCloud(userData.uid, { keys, config, modelStats, logs }); }, [modelStats, cloudLoaded, userData]);\n", "");

const combined = `
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS, JSON.stringify(keys));
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
    localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs));
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config));
    localStorage.setItem(STORAGE_STATS, JSON.stringify(modelStats));
    if (cloudLoaded && userData) {
      syncUserDataToCloud(userData.uid, { keys, config, modelStats, logs });
    }
  }, [keys, history, logs, config, modelStats, cloudLoaded, userData]);
`;

content = content.replace("// Persist State", "// Persist State" + combined);

fs.writeFileSync('src/App.tsx', content);
