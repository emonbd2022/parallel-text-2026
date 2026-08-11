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
  \`;
  promptParts.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: config.model,
      contents: { parts: promptParts },
      config: {`;

const newPromptText = `  const systemInstruction = \`You are an expert Adobe Stock metadata creator.
Your task is to generate Adobe Stock-ready titles and keywords for images.
For each image:
1. Create a highly commercial and descriptive title containing highly searched keywords.
    - The title MUST consist of 1 to 2 complete sentences.
    - The first sentence should vividly describe the main subject, setting, action, and lighting.
    - The final sentence MUST suggest a practical use case or conceptual theme for the image.
2. Produce accurate, SEO-friendly keywords optimized for Adobe Stock sales.
    - Focus on conceptual terms, emotions, setting, lighting, and specific subject details.
    - Include synonyms and related concepts that buyers might search for.
    - Avoid generic or irrelevant terms.
    - ORDER them strictly by relevance and visual importance. The first 10 keywords dictate search ranking and MUST be the strongest descriptors. DO NOT sort the keywords alphabetically. Exclude all trademarks.\`;

  const promptText = \`I have provided \${items.length} image(s). 
Generate metadata for EACH image in the exact order they were provided (Index 0 to \${items.length - 1}).

Specific constraints for this batch:
- \${transparencyDirective}
- The title MUST be precise, using a maximum of 25 words, and strictly UNDER \${config.titleMaxLen || 180} characters in length (including spaces). Be extremely concise.
- Produce exactly \${config.keywordsCount} keywords.

Return a strictly valid JSON array where each object contains:
- "index": integer (0-based index corresponding to the input order)
- "title": string
- "keywords": array of strings\`;

  promptParts.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: config.model,
      contents: { parts: promptParts },
      config: {
        systemInstruction: systemInstruction,`;

code = code.replace(oldPromptText, newPromptText);
fs.writeFileSync('src/services/geminiService.ts', code);
