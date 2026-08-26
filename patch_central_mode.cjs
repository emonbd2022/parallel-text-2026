const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/if \(\!globalCentralModeEnabled/g, '// if (!global'); // disable the previous one
const centralModeCheck = `if (!globalCentralModeEnabled && !isAdmin && !hasExplicitAdminGrant) {
                const isJson = res.json !== undefined;
                if (isJson) {
                    return res.status(403).json({ success: false, error: "Central API Mode is currently disabled by the administrator.", keys: [] });
                } else {
                    throw new Error("Central API Mode is currently disabled by the administrator.");
                }
            }
            if (!isEligible) {`;
code = code.replace(/if \(\!isEligible\) \{/g, centralModeCheck);
fs.writeFileSync('server.ts', code);
