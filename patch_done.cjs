const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /status: 'done',\s+title: results\[p\.id\]\.title,\s+keywords: results\[p\.id\]\.keywords,/g;
const replacement = `status: 'done', 
                title: results[p.id].title, 
                keywords: results[p.id].keywords,
                category: results[p.id].category,`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/App.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
