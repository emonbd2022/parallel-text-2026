const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

code = code.replace("  }, [userData]);", "  }, [userData?.uid, userData?.role]);");

fs.writeFileSync('src/components/Layout.tsx', code);
