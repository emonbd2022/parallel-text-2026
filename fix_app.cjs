const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add refs for pending updates
code = code.replace(
  "  const [toasts, setToasts] = useState<Toast[]>([]);",
  `  const [toasts, setToasts] = useState<Toast[]>([]);
  const pendingCreditsRef = useRef(0);
  const pendingImagesRef = useRef(0);`
);

// 2. Add useEffect for credit sync
code = code.replace(
  "  useEffect(() => {\n    const idx = setInterval(() => localStorage.setItem('sessionReqCount', sessionRequestCountRef.current.toString()), 5000);\n    return () => clearInterval(idx);\n  }, []);",
  `  useEffect(() => {
    const idx = setInterval(() => localStorage.setItem('sessionReqCount', sessionRequestCountRef.current.toString()), 5000);
    return () => clearInterval(idx);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if ((pendingCreditsRef.current > 0 || pendingImagesRef.current > 0) && userData) {
        const creditsToDeduct = pendingCreditsRef.current;
        const imagesToAdd = pendingImagesRef.current;
        
        pendingCreditsRef.current = 0;
        pendingImagesRef.current = 0;

        try {
          if (!userData.unlimited) {
            await updateDoc(doc(db, 'users', userData.uid), {
              credits: increment(-creditsToDeduct),
              totalProcessedImages: increment(imagesToAdd)
            });
          } else {
            await updateDoc(doc(db, 'users', userData.uid), {
              totalProcessedImages: increment(imagesToAdd)
            });
          }
        } catch (e) {
          console.error('Failed to update credits', e);
          pendingCreditsRef.current += creditsToDeduct;
          pendingImagesRef.current += imagesToAdd;
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [userData]);`
);

// 3. Replace the per-item updateDoc with ref updates
code = code.replace(
  /      if \(results && Object\.keys\(results\)\.length > 0 && userData\) \{\s*const numSuccess = Object\.keys\(results\)\.length;\s*try \{\s*if \(!userData\.unlimited\) \{\s*await updateDoc\(doc\(db, 'users', userData\.uid\), \{\s*credits: increment\(-numSuccess\),\s*totalProcessedImages: increment\(numSuccess\)\s*\}\);\s*\} else \{\s*await updateDoc\(doc\(db, 'users', userData\.uid\), \{\s*totalProcessedImages: increment\(numSuccess\)\s*\}\);\s*\}\s*\} catch \(e\) \{\s*console\.error\('Failed to update credits', e\);\s*\}\s*\}/,
  `      if (results && Object.keys(results).length > 0 && userData) {
        const numSuccess = Object.keys(results).length;
        pendingCreditsRef.current += numSuccess;
        pendingImagesRef.current += numSuccess;
      }`
);

// 4. Refactor the syncing logic
code = code.replace(
  /  \/\/ Persist State\s*useEffect\(\(\) => \{\s*localStorage\.setItem\(STORAGE_KEYS, JSON\.stringify\(keys\)\);\s*localStorage\.setItem\(STORAGE_HISTORY, JSON\.stringify\(history\)\);\s*localStorage\.setItem\(STORAGE_LOGS, JSON\.stringify\(logs\)\);\s*localStorage\.setItem\(STORAGE_CONFIG, JSON\.stringify\(config\)\);\s*localStorage\.setItem\(STORAGE_STATS, JSON\.stringify\(modelStats\)\);\s*if \(cloudLoaded && userData\) \{\s*syncUserDataToCloud\(userData\.uid, \{ keys, config, modelStats, logs \}\);\s*\}\s*\}, \[keys, history, logs, config, modelStats, cloudLoaded, userData\?\.uid\]\);/,
  `  // Persist State
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
  }, [modelStats]);`
);

fs.writeFileSync('src/App.tsx', code);
