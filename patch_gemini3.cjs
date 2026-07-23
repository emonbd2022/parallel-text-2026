const fs = require('fs');
let content = fs.readFileSync('src/services/geminiService.ts', 'utf8');

content = content.replace(
    /"category": string \(MUST be exactly one of these 20 options: "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel"\)/g,
    `"category": string (MUST be exactly one of these 21 options: "Animals", "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel")`
);

content = content.replace(
    /category: resItem\.category \|\| "Technology"/g,
    `category: resItem.category || ""`
);

fs.writeFileSync('src/services/geminiService.ts', content);
