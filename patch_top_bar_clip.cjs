const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<main
        className="flex-1 flex flex-col h-full overflow-hidden relative"
      >
        <div className="h-1.5 bg-slate-900 w-full shrink-0 z-50 relative flex items-center">`;

const replacement = `<main
        className="flex-1 flex flex-col h-full overflow-hidden relative pt-2"
      >
        <div className="h-1.5 bg-slate-900 w-full shrink-0 z-50 relative flex items-center rounded-r-full">`;

content = content.replace(target, replacement);

fs.writeFileSync('src/App.tsx', content);
