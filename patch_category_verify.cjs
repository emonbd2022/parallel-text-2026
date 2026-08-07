const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const searchCode = `    if (Array.isArray(catArray)) {
        catArray.forEach(catItem => {
            const idx = catItem.index;
            if (idx >= 0 && idx < items.length) {
                const originalId = items[idx].id;
                results[originalId] = { category: catItem.category || "" };
            }
        });
    }

    return results;`;

const replaceCode = `    let finalArray = catArray;
    
    // SECOND PASS: Re-check the categories
    if (Array.isArray(catArray) && catArray.length > 0) {
        if (onProgress) onProgress("Verifying categories...");
        const verificationPromptText = \`You are a Senior Quality Assurance reviewer for Adobe Stock categories.
Review the following list of titles and their assigned categories. 
If a category is incorrect based on the title's primary subject, correct it. Be very careful to distinguish between "Industry" and "Food".

Only use one of the following exact categories:
"Animals", "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel"

Items to review:
\${catArray.map(c => \`Index \${c.index}: Title: "\${items[c.index]?.title}", Proposed Category: "\${c.category}"\`).join('\\n')}

Return ONLY a valid JSON array of objects, with:
{ "index": <0-based integer>, "category": "<the verified or corrected category>" }
\`;
        try {
            const verResponse = await ai.models.generateContent({
              model,
              contents: verificationPromptText,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      index: { type: Type.INTEGER },
                      category: { type: Type.STRING }
                    },
                    required: ["index", "category"]
                  }
                }
              }
            });
            const verText = verResponse.text;
            if (verText) {
                finalArray = JSON.parse(verText);
            }
        } catch (verErr) {
            console.error("Verification failed, falling back to first pass", verErr);
        }
    }

    if (Array.isArray(finalArray)) {
        finalArray.forEach(catItem => {
            const idx = catItem.index;
            if (idx >= 0 && idx < items.length) {
                const originalId = items[idx].id;
                results[originalId] = { category: catItem.category || "" };
            }
        });
    }

    return results;`;

code = code.replace(searchCode, replaceCode);
fs.writeFileSync('src/services/geminiService.ts', code);
