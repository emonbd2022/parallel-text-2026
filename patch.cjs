const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const allKeysExhausted = activeKeys\.every\(k => newFailedKeys\.includes\(k\.id\)\);\s+if \(allKeysExhausted && activeKeys\.length > 0\) \{\s+return \{\s+\.\.\.p,\s+status: 'error',\s+errorMsg: `All API keys failed for this image.`,\s+assignedKeyId: undefined,\s+failedKeyIds: newFailedKeys\s+\};\s+\} else \{\s+return \{\s+\.\.\.p,\s+status: 'pending',\s+assignedKeyId: undefined,\s+failedKeyIds: newFailedKeys,\s+attempts: p\.attempts \+ 1,\s+retryAfter: Date\.now\(\) \+ 2000\s+\};\s+\}/g;

const replacement = `const allKeysExhausted = activeKeys.every(k => newFailedKeys.includes(k.id));
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

if (regex.test(content)) {
    fs.writeFileSync('src/App.tsx', content.replace(regex, replacement));
    console.log("Success");
} else {
    console.log("Target not found!");
}
