const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  // --- SAVE PROJECT ---`;
const replacement = `  // Auto retry failed items every 20 seconds while batch is running
  useEffect(() => {
      if (!isProcessing) return;
      const interval = setInterval(() => {
          setItems(prev => {
              let changed = false;
              const newItems = prev.map(p => {
                  if (p.status === 'error' || (p.status === 'pending' && p.attempts > 3)) {
                      changed = true;
                      return {
                          ...p,
                          status: 'pending',
                          errorMsg: undefined,
                          assignedKeyId: undefined,
                          failedKeyIds: p.errorMsg?.includes('All API keys') ? [] : p.failedKeyIds,
                          attempts: 0,
                          retryAfter: undefined
                      };
                  }
                  return p;
              });
              return changed ? newItems : prev;
          });
      }, 20000);
      return () => clearInterval(interval);
  }, [isProcessing]);

  // --- SAVE PROJECT ---`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
