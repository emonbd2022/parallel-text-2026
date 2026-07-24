const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const lastBracketIndex = content.lastIndexOf('}');
const lastParenthesisIndex = content.lastIndexOf(')', lastBracketIndex);

content = content.substring(0, lastParenthesisIndex) + '</>\n  ' + content.substring(lastParenthesisIndex);

fs.writeFileSync('src/App.tsx', content);
