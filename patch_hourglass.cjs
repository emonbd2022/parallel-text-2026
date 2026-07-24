const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /<Hourglass className="w-3\.5 h-3\.5 mr-1 animate-pulse" \/>/,
  `<svg className="w-3.5 h-3.5 mr-1" style={{ animation: 'spin 2s ease-in-out infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>`
);
// note: using <style> for keyframes if spin isn't defined? wait, tailwind's 'animate-spin' defines a linear spin. 
// We can use a custom keyframe.
content = content.replace(
  `return (`,
  `return (
    <>
      <style>{\`
        @keyframes hourglass-flip {
          0% { transform: rotate(0deg); }
          40% { transform: rotate(180deg); }
          100% { transform: rotate(180deg); }
        }
        .hourglass-anim {
          animation: hourglass-flip 2s ease-in-out infinite;
        }
      \`}</style>`
);

content = content.replace(
  `<svg className="w-3.5 h-3.5 mr-1" style={{ animation: 'spin 2s ease-in-out infinite' }} viewBox="0 0 24 24"`,
  `<svg className="w-3.5 h-3.5 mr-1 hourglass-anim" viewBox="0 0 24 24"`
);

// We need to close the fragment at the end.
content = content.replace(
  /  \);\n\};\n\nexport default App;/g,
  `    </>\n  );\n};\n\nexport default App;`
);

fs.writeFileSync('src/App.tsx', content);
