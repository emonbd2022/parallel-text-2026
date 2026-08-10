const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldErrorLogic = `      const errorMessage = error.message || "Unknown error";
      const isQuota = errorMessage.includes('QUOTA_EXCEEDED');
      const isInvalid = errorMessage.includes('INVALID_KEY');
      
      const cooldownMs = isQuota ? 3600000 : (isInvalid ? 86400000 : 30000);
 
      setKeys(prev => prev.map(k => {
          if (k.id === keyObj.id) {
              return { 
                  ...k, 
                  errorCount: k.errorCount + 1,
                  cooldownUntil: Date.now() + cooldownMs
              };
          }
          return k;
      }));`;

const newErrorLogic = `      const errorMessage = error.message || "Unknown error";
      let cooldownTime = 0;
      let errorPenalty = 1;

      if (errorMessage.includes('QUOTA_EXCEEDED') || errorMessage.includes('429')) {
        cooldownTime = 60 * 1000;
        errorPenalty = 0; // Do not penalize for rate limits
      } else if (errorMessage.includes('INVALID_KEY')) {
        errorPenalty = 10; // Kill invalid keys immediately
      } else {
        errorPenalty = 1; // Standard penalty for other errors
      }
 
      setKeys(prev => prev.map(k => {
          if (k.id === keyObj.id) {
              return { 
                  ...k, 
                  errorCount: k.errorCount + errorPenalty,
                  cooldownUntil: cooldownTime > 0 ? Date.now() + cooldownTime : undefined
              };
          }
          return k;
      }));`;

code = code.replace(oldErrorLogic, newErrorLogic);
fs.writeFileSync('src/App.tsx', code);
