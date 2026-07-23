const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const regex = /results\[originalId\] = \{\s+title: finalTitle,\s+keywords: keywordsList\.join\(\', \'\)/;
const replacement = `results[originalId] = {
            title: finalTitle,
            keywords: keywordsList.join(', '),
            category: resItem.category || "Technology"`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('src/services/geminiService.ts', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
