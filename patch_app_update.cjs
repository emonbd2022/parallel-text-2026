const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const updateItem = \(id: string, field: 'title' \| 'keywords', value: string\) => \{/g;
const replacement = `const updateItem = (id: string, field: 'title' | 'keywords' | 'category', value: string) => {`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
