const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Add import
if (!content.includes('syncUserDataToCloud')) {
    content = content.replace(
        "import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';",
        "import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';\nimport { syncUserDataToCloud } from './lib/sync';"
    );
}

// Add state
if (!content.includes('const [cloudLoaded, setCloudLoaded]')) {
    content = content.replace(
        "const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);",
        "const [cloudLoaded, setCloudLoaded] = useState(false);\n  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);"
    );
}

// Add load effect
if (!content.includes('// Load from cloud')) {
    content = content.replace(
        "// Persist State",
        `// Load from cloud
  useEffect(() => {
    if (userData && !cloudLoaded) {
      if (userData.appData) {
        if (userData.appData.keys) setKeys(userData.appData.keys);
        if (userData.appData.config) setConfig(userData.appData.config);
        if (userData.appData.modelStats) setModelStats(userData.appData.modelStats);
        if (userData.appData.logs) setLogs(userData.appData.logs);
      }
      setCloudLoaded(true);
    }
  }, [userData, cloudLoaded]);

  // Persist State`
    );
}

// Update effects
content = content.replace(
    "useEffect(() => localStorage.setItem(STORAGE_KEYS, JSON.stringify(keys)), [keys]);",
    "useEffect(() => { localStorage.setItem(STORAGE_KEYS, JSON.stringify(keys)); if (cloudLoaded && userData) syncUserDataToCloud(userData.uid, { keys, config, modelStats, logs }); }, [keys, cloudLoaded, userData]);"
);
content = content.replace(
    "useEffect(() => localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs)), [logs]);",
    "useEffect(() => { localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs)); if (cloudLoaded && userData) syncUserDataToCloud(userData.uid, { keys, config, modelStats, logs }); }, [logs, cloudLoaded, userData]);"
);
content = content.replace(
    "useEffect(() => localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config)), [config]);",
    "useEffect(() => { localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config)); if (cloudLoaded && userData) syncUserDataToCloud(userData.uid, { keys, config, modelStats, logs }); }, [config, cloudLoaded, userData]);"
);
content = content.replace(
    "useEffect(() => localStorage.setItem(STORAGE_STATS, JSON.stringify(modelStats)), [modelStats]);",
    "useEffect(() => { localStorage.setItem(STORAGE_STATS, JSON.stringify(modelStats)); if (cloudLoaded && userData) syncUserDataToCloud(userData.uid, { keys, config, modelStats, logs }); }, [modelStats, cloudLoaded, userData]);"
);

fs.writeFileSync('src/App.tsx', content);
console.log('App patched.');
