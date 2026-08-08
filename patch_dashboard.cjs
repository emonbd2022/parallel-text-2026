const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace("  }, [userData]);\n\n  useEffect(() => {", "  }, [userData?.appData]);\n\n  useEffect(() => {");
code = code.replace("    fetchExports();\n  }, [userData]);", "    fetchExports();\n  }, [userData?.uid]);");

fs.writeFileSync('src/pages/Dashboard.tsx', code);
