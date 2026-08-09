const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const oldPromptText = `  const promptText = \`
    I have provided \${items.length} image(s). 
    Generate Adobe Stock-ready metadata for EACH image in the exact order they were provided (Index 0 to \${items.length - 1}).

    For each image:
    1. Create a highly commercial and descriptive title containing highly searched keywords.
        - The title MUST consist of 1 to 2 complete sentences.
        - The first sentence should vividly describe the main subject, setting, action, and lighting (e.g., "Grain pouring into a large pile in a warehouse.").
       - The final sentence MUST suggest a practical use case or conceptual theme for the image (e.g., "Food supply concept for industrial trade ads.").
       - \${transparencyDirective}
       - CRITICAL: The ENTIRE title MUST be precise, using a maximum of 25 words, and strictly UNDER \${config.titleMaxLen || 180} characters in length (including spaces). Be extremely concise.
    2. Produce exactly \${config.keywordsCount} accurate, SEO-friendly keywords optimized for Adobe Stock sales.
       - Focus on conceptual terms, emotions, setting, lighting, and specific subject details.
       - Include synonyms and related concepts that buyers might search for.
       - Avoid generic or irrelevant terms.
       - ORDER them strictly by relevance and visual importance—from most critical to least important. The first 10 keywords dictate search ranking and MUST be the strongest descriptors. DO NOT sort the keywords alphabetically. Exclude all trademarks.
    
    Return a strictly valid JSON array where each object contains:
    - "index": integer (0-based index corresponding to the input order)
    - "title": string
    - "keywords": array of strings
  \`;`;

const newPromptText = `  const promptText = \`
    I have provided \${items.length} image(s). 
    Generate Adobe Stock-ready metadata for EACH image in the exact order they were provided (Index 0 to \${items.length - 1}).

    For each image:
    1. Create a highly commercial and descriptive title containing highly searched keywords.
        - The title MUST consist of 1 to 2 complete sentences.
        - The first sentence should vividly describe the main subject, setting, action, and lighting (e.g., "Grain pouring into a large pile in a warehouse.").
       - The final sentence MUST suggest a practical use case or conceptual theme for the image (e.g., "Food supply concept for industrial trade ads.").
       - \${transparencyDirective}
       - CRITICAL: The ENTIRE title MUST be precise, using a maximum of 25 words, and strictly UNDER \${config.titleMaxLen || 180} characters in length (including spaces). Be extremely concise.
    2. Produce exactly \${config.keywordsCount} accurate, SEO-friendly keywords optimized for Adobe Stock sales.
       - Focus on conceptual terms, emotions, setting, lighting, and specific subject details.
       - Include synonyms and related concepts that buyers might search for.
       - Avoid generic or irrelevant terms.
       - ORDER them strictly by relevance and visual importance—from most critical to least important. The first 10 keywords dictate search ranking and MUST be the strongest descriptors. DO NOT sort the keywords alphabetically. Exclude all trademarks.
    3. Classify the image into exactly ONE of the following Adobe Stock categories based on its primary subject and real-life commercial use intent:
       "Animals", "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel".
       - Determine the dominant subject of the entire image. Make sure not to confuse conceptually different fields (e.g. quantum chips are "Technology" not "Hobbies and Leisure"; banks are "Business" not "Travel").
    
    Return a strictly valid JSON array where each object contains:
    - "index": integer (0-based index corresponding to the input order)
    - "title": string
    - "keywords": array of strings
    - "category": string
  \`;`;

const oldSchema = `            properties: {
              index: { type: Type.INTEGER },
              title: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["index", "title", "keywords"]`;

const newSchema = `            properties: {
              index: { type: Type.INTEGER },
              title: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              category: { type: Type.STRING }
            },
            required: ["index", "title", "keywords", "category"]`;

const oldParsing = `          let keywordsList = resItem.keywords || [];
          if (!Array.isArray(keywordsList)) keywordsList = String(keywordsList).split(',').map((s: string) => s.trim());
          
          results[originalId] = {
              title,
              keywords: keywordsList.map((k: string) => k.replace(/['"]/g, '').trim()).filter((k: string) => k).join(', ')
          };`;

const newParsing = `          let keywordsList = resItem.keywords || [];
          if (!Array.isArray(keywordsList)) keywordsList = String(keywordsList).split(',').map((s: string) => s.trim());
          
          results[originalId] = {
              title,
              keywords: keywordsList.map((k: string) => k.replace(/['"]/g, '').trim()).filter((k: string) => k).join(', '),
              category: resItem.category || ""
          };`;

code = code.replace(oldPromptText, newPromptText);
code = code.replace(oldSchema, newSchema);
code = code.replace(oldParsing, newParsing);

fs.writeFileSync('src/services/geminiService.ts', code);
