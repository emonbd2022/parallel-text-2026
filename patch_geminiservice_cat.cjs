const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const oldPromptText = `    3. Classify the image into exactly ONE of the following Adobe Stock categories based on its primary subject and real-life commercial use intent:
       "Animals", "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel".
       - Determine the dominant subject of the entire image. Make sure not to confuse conceptually different fields (e.g. quantum chips are "Technology" not "Hobbies and Leisure"; banks are "Business" not "Travel").
    
    Return a strictly valid JSON array where each object contains:`;

const newPromptText = `    3. Classify the image into exactly ONE of the following Adobe Stock categories based on its primary subject and real-life commercial use intent.
       STRICT MAPPING INSTRUCTION: You MUST use ONLY the exact category strings listed below. Do not generate arbitrary labels.
       "Animals", "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel".
       - Determine the dominant subject of the entire image. Make sure not to confuse conceptually different fields (e.g. quantum chips are "Technology" not "Hobbies and Leisure"; banks are "Business" not "Travel", lawn mowers are "Hobbies and Leisure" or "Business" but NOT "Sports").
    
    Return a strictly valid JSON array where each object contains:`;

code = code.replace(oldPromptText, newPromptText);
fs.writeFileSync('src/services/geminiService.ts', code);
