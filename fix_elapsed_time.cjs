const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// replace startTimeMs state with elapsedMs
code = code.replace(
  `const [startTimeMs, setStartTimeMs] = useState<number | null>(() => {
    const s = localStorage.getItem('startTimeMs');
    return s ? parseInt(s, 10) : null;
  });`,
  `const [elapsedMs, setElapsedMs] = useState<number>(() => {
    const s = localStorage.getItem('elapsedMs');
    return s ? parseInt(s, 10) : 0;
  });`
);

code = code.replace(
  `useEffect(() => {
    if (startTimeMs) localStorage.setItem('startTimeMs', startTimeMs.toString());
    else localStorage.removeItem('startTimeMs');
  }, [startTimeMs]);`,
  `useEffect(() => {
    localStorage.setItem('elapsedMs', elapsedMs.toString());
  }, [elapsedMs]);
  
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isProcessing) {
      interval = setInterval(() => {
        setElapsedMs(prev => prev + 1000);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);`
);

// handleClear
code = code.replace(
  `setStartTimeMs(null);`,
  `setElapsedMs(0);`
);

// handleExport
code = code.replace(
  `if (startTimeMs) {
      const elapsedMs = Math.max(0, Date.now() - startTimeMs);
      const elapsedSecs = Math.floor(elapsedMs / 1000);`,
  `{
      const elapsedSecs = Math.floor(elapsedMs / 1000);`
);

// UI node calculation
code = code.replace(
  `if (startTimeMs) {
      const elapsedMs = Math.max(0, Date.now() - startTimeMs);
      const elapsedSecs = Math.floor(elapsedMs / 1000);`,
  `if (elapsedMs > 0) {
      const elapsedSecs = Math.floor(elapsedMs / 1000);`
);

// remove setStartTimeMs call in process queue logic
code = code.replace(
  `if (!startTimeMs) setStartTimeMs(Date.now());`,
  ``
);

fs.writeFileSync('src/App.tsx', code);
