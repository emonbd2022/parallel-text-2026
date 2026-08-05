const fs = require('fs');
let code = fs.readFileSync('src/components/ProcessingQueue.tsx', 'utf-8');

code = code.replace(
  "{item.status === 'processing' && <div className=\"w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse\"/>}",
  "{item.status === 'processing' && <Cat className=\"w-4 h-4 text-purple-400 animate-bounce\"/>}"
);

if (!code.includes('import { Cat')) {
    code = code.replace("import { Trash2, Image as ImageIcon, Copy, Check, RefreshCw } from 'lucide-react';", "import { Trash2, Image as ImageIcon, Copy, Check, RefreshCw, Cat } from 'lucide-react';");
}

fs.writeFileSync('src/components/ProcessingQueue.tsx', code);
