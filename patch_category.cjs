const fs = require('fs');
let code = fs.readFileSync('src/services/geminiCategoryService.ts', 'utf8');

const oldPromptText = `  const categoryPromptText = \`You are an expert Adobe Stock content reviewer.
Classify each title into the SINGLE best Adobe Stock category based on its primary subject and commercial intent.

Rules:
- Choose exactly ONE category for every title.
- Determine the dominant subject of the entire title, not individual keywords.
- Consider what a stock buyer would primarily search for.
- If multiple categories seem valid, select the most specific and commercially relevant one.
- Ignore secondary elements unless they are the main focus.
- Use ONLY the categories listed below, exactly as written.
- Return only the category name for each title. Do not explain your reasoning.

1: Animals
2: Buildings and Architecture
3: Business
4: Drinks
5: The Environment
6: States of Mind
7: Food
8: Graphic Resources
9: Hobbies and Leisure
10: Industry
11: Landscapes
12: Lifestyle
13: People
14: Plants and Flowers
15: Culture and Religion
16: Science
17: Social Issues
18: Sports
19: Technology
20: Transport
21: Travel

Titles:
\${titlesForCategory.join('\\n')}

Return ONLY a valid JSON array.
Each object must have exactly:
{
  "index": <0-based integer>,
  "category": "<one of the 21 categories above>"
}
Do not include explanations, markdown, comments, or any additional text.\`;

  try {
    const catResponse = await ai.models.generateContent({
      model,
      contents: categoryPromptText,
      config: {`;

const newPromptText = `  const systemInstruction = \`You are an expert Adobe Stock content reviewer.
Classify each title into the SINGLE best Adobe Stock category based on its primary subject and commercial intent.

Rules:
- Choose exactly ONE category for every title.
- Determine the dominant subject of the entire title, not individual keywords.
- Consider what a stock buyer would primarily search for.
- If multiple categories seem valid, select the most specific and commercially relevant one.
- Ignore secondary elements unless they are the main focus.
- Use ONLY the categories listed below, exactly as written.
- Return only the category name for each title. Do not explain your reasoning.

1: Animals
2: Buildings and Architecture
3: Business
4: Drinks
5: The Environment
6: States of Mind
7: Food
8: Graphic Resources
9: Hobbies and Leisure
10: Industry
11: Landscapes
12: Lifestyle
13: People
14: Plants and Flowers
15: Culture and Religion
16: Science
17: Social Issues
18: Sports
19: Technology
20: Transport
21: Travel\`;

  const categoryPromptText = \`Titles:
\${titlesForCategory.join('\\n')}

Return ONLY a valid JSON array.
Each object must have exactly:
{
  "index": <0-based integer>,
  "category": "<one of the 21 categories above>"
}
Do not include explanations, markdown, comments, or any additional text.\`;

  try {
    const catResponse = await ai.models.generateContent({
      model,
      contents: categoryPromptText,
      config: {
        systemInstruction: systemInstruction,`;

code = code.replace(oldPromptText, newPromptText);
fs.writeFileSync('src/services/geminiCategoryService.ts', code);
