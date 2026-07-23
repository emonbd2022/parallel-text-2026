const fs = require('fs');
let content = fs.readFileSync('src/components/ProcessingQueue.tsx', 'utf8');

const regex = /onUpdate: \(id: string, field: 'title' \| 'keywords', value: string\) => void;/g;
const replacement = `onUpdate: (id: string, field: 'title' | 'keywords' | 'category', value: string) => void;`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/components/ProcessingQueue.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
