const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  `}
    }, 5000);
    return () => clearInterval(interval);`,
  `}
    }, 30000);
    return () => clearInterval(interval);`
);

fs.writeFileSync('src/App.tsx', code);
