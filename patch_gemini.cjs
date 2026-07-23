const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const regex1 = /Return a strictly valid JSON array where each object contains:\s+- "index": integer \(0-based index corresponding to the input order\)\s+- "title": string\s+- "keywords": array of strings/;

const replacement1 = `Return a strictly valid JSON array where each object contains:
    - "index": integer (0-based index corresponding to the input order)
    - "title": string
    - "keywords": array of strings
    - "category": string (MUST be exactly one of these 20 options: "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel")`;

const regex2 = /index: { type: Type\.INTEGER },\s+title: { type: Type\.STRING },\s+keywords: { type: Type\.ARRAY, items: { type: Type\.STRING } },/;

const replacement2 = `              index: { type: Type.INTEGER },
              title: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              category: { type: Type.STRING },`;

const regex3 = /required: \["index", "title", "keywords"\]/;
const replacement3 = `required: ["index", "title", "keywords", "category"]`;

if (regex1.test(content) && regex2.test(content) && regex3.test(content)) {
    content = content.replace(regex1, replacement1);
    content = content.replace(regex2, replacement2);
    content = content.replace(regex3, replacement3);
    fs.writeFileSync('src/services/geminiService.ts', content);
    console.log("Success");
} else {
    console.log("Target not found!");
}
