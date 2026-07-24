const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  "import { Clock, Key } from 'lucide-react';",
  "import { Clock, Key, Hourglass } from 'lucide-react';"
);

content = content.replace(
  /<Clock className="w-3\.5 h-3\.5 mr-1" \/>\n\s*ETA:/,
  `<Hourglass className="w-3.5 h-3.5 mr-1 animate-pulse" />
             Estimated Time:`
);

content = content.replace(
  /Elapsed:/,
  `Elapsed Time:`
);

fs.writeFileSync('src/App.tsx', content);
