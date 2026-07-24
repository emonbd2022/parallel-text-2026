const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const linkTarget = `<a href="file:///C:/Users/Public/Downloads" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Downloads folder</a>`;
const linkReplacement = `<a href="file:///" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline font-bold" onClick={(e) => { e.preventDefault(); window.open('file:///C:/', '_blank') || alert('Browser blocked opening local folder directly. Please open Downloads manually.'); }}>Downloads folder</a>`;

content = content.replace(linkTarget, linkReplacement);
fs.writeFileSync('src/App.tsx', content);
