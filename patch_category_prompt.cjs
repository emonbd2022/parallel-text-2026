const fs = require('fs');
let code = fs.readFileSync('src/services/geminiCategoryService.ts', 'utf8');

const oldPrompt = `Titles:
\${titlesForCategory.join('\\n')}

Return ONLY a valid JSON array.
Each object must have exactly:
{
  "index": <0-based integer>,
  "category": "<one of the 21 categories above>"
}
Do not include explanations, markdown, comments, or any additional text.\`;`;

const newPrompt = `Titles:
\${titlesForCategory.join('\\n')}

Return ONLY a valid JSON array.
Each object must have exactly:
{
  "index": <0-based integer>,
  "category": "<just the number of the category, e.g. 1>"
}
Do not include explanations, markdown, comments, or any additional text.\`;`;

code = code.replace(oldPrompt, newPrompt);
fs.writeFileSync('src/services/geminiCategoryService.ts', code);
