const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldErrorHandle = `      setItems(prev => prev.map(p => {
          if (batchItems.find(b => b.id === p.id)) {
              const newFailedKeys = [...p.failedKeyIds, keyObj.id];
              return {
                  ...p,
                  status: 'error',
                  errorMsg: errorMessage,
                  progressMsg: undefined,
                  assignedKeyId: undefined,
                  failedKeyIds: newFailedKeys,
                  attempts: p.attempts + 1,
                  retryAfter: Date.now() + 5000
              };
          }
          return p;
      }));`;

const newErrorHandle = `      setItems(prev => {
        const activeKeys = keys.filter(k => k.errorCount < 20);
        return prev.map(p => {
            if (batchItems.find(b => b.id === p.id)) {
                const newFailedKeys = [...(p.failedKeyIds || []), keyObj.id];
                const allKeysExhausted = activeKeys.every(k => newFailedKeys.includes(k.id));
                const backoffDelay = Math.min(2000 * Math.pow(2, p.attempts), 120000);
                
                if (allKeysExhausted && activeKeys.length > 0) {
                     return {
                          ...p,
                          status: 'pending',
                          errorMsg: errorMessage,
                          progressMsg: undefined,
                          assignedKeyId: undefined,
                          failedKeyIds: [],
                          attempts: p.attempts + 1,
                          retryAfter: Date.now() + Math.max(backoffDelay, 30000)
                     };
                } else {
                     return {
                          ...p,
                          status: 'pending',
                          errorMsg: errorMessage,
                          progressMsg: undefined,
                          assignedKeyId: undefined,
                          failedKeyIds: newFailedKeys,
                          attempts: p.attempts + 1,
                          retryAfter: Date.now() + backoffDelay
                     };
                }
            }
            return p;
        });
      });`;

code = code.replace(oldErrorHandle, newErrorHandle);
fs.writeFileSync('src/App.tsx', code);
