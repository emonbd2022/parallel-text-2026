const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                const allKeysExhausted = activeKeys.every(k => newFailedKeys.includes(k.id));
                if (allKeysExhausted && activeKeys.length > 0) {
                     return {
                          ...p,
                          status: 'error',
                          errorMsg: \`All API keys failed for this image.\`,
                          assignedKeyId: undefined,
                         failedKeyIds: newFailedKeys
                     };
                } else {
                     return {
                          ...p,
                          status: 'pending',
                          assignedKeyId: undefined,
                          failedKeyIds: newFailedKeys,
                         attempts: p.attempts + 1,
                         retryAfter: Date.now() + 2000 
                     };
                }`;

const replacement = `                const allKeysExhausted = activeKeys.every(k => newFailedKeys.includes(k.id));
                const backoffDelay = Math.min(2000 * Math.pow(2, p.attempts), 120000); // Exponential backoff up to 2 mins
                if (allKeysExhausted && activeKeys.length > 0) {
                     return {
                          ...p,
                          status: 'pending',
                          assignedKeyId: undefined,
                          failedKeyIds: [], // Auto retry by resetting failed keys
                          attempts: p.attempts + 1,
                          retryAfter: Date.now() + Math.max(backoffDelay, 30000) // At least 30s backoff if all keys failed
                     };
                } else {
                     return {
                          ...p,
                          status: 'pending',
                          assignedKeyId: undefined,
                          failedKeyIds: newFailedKeys,
                         attempts: p.attempts + 1,
                         retryAfter: Date.now() + backoffDelay 
                     };
                }`;

fs.writeFileSync('src/App.tsx', content.replace(target, replacement));
