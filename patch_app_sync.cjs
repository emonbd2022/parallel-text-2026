const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldSync = `  // Persist State
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS, JSON.stringify(keys));
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config));
    if (cloudLoaded && userData) {
      syncUserDataToCloud(userData.uid, { keys, config });
    }
  }, [keys, config, cloudLoaded, userData?.uid]);

  useEffect(() => {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_STATS, JSON.stringify(modelStats));
  }, [modelStats]);`;

const newSync = `  // Persist State
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS, JSON.stringify(keys));
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config));
    if (cloudLoaded && userData) {
      syncUserDataToCloud(userData.uid, { keys, config });
    }
  }, [keys, config, cloudLoaded, userData?.uid]);

  useEffect(() => {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history));
    if (cloudLoaded && userData) {
        syncUserDataToCloud(userData.uid, { history });
    }
  }, [history, cloudLoaded, userData?.uid]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs));
    if (cloudLoaded && userData) {
        syncUserDataToCloud(userData.uid, { logs });
    }
  }, [logs, cloudLoaded, userData?.uid]);

  useEffect(() => {
    localStorage.setItem(STORAGE_STATS, JSON.stringify(modelStats));
    if (cloudLoaded && userData) {
        syncUserDataToCloud(userData.uid, { modelStats });
    }
  }, [modelStats, cloudLoaded, userData?.uid]);`;

code = code.replace(oldSync, newSync);
fs.writeFileSync('src/App.tsx', code);
