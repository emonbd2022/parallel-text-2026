const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const oldPromptBlock = `    const categoryPromptText = \`
      I will provide \${items.length} titles. Please categorize each into the ONE best Adobe Stock category by its primary subject and commercial meaning, not keywords. exactly one of these 21 options:
      "Animals", "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel"
      
      Titles:
      \${titlesForCategory.join('\\n')}
      
      Return a strictly valid JSON array where each object contains:
      - "index": integer (0-based index)
      - "category": string
    \`;`;

const newPromptBlock = `    const categoryPromptText = \`
You are an expert Adobe Stock content reviewer.

Your task is to classify each title into the SINGLE most appropriate Adobe Stock category based on the primary subject and commercial intent of the title.

Classification Rules:
- Choose exactly ONE category for each title.
- Base your decision on the main subject, not isolated keywords.
- Consider the overall meaning, context, and what a buyer would expect.
- Never use a category just because a keyword appears if another category better represents the title.
- If multiple categories seem possible, choose the one that best describes the dominant subject.
- Be consistent across all titles.
- Only use one of the following categories exactly as written:

"Animals"
"Buildings and Architecture"
"Business"
"Drinks"
"The Environment"
"States of Mind"
"Food"
"Graphic Resources"
"Hobbies and Leisure"
"Industry"
"Landscapes"
"Lifestyle"
"People"
"Plants and Flowers"
"Culture and Religion"
"Science"
"Social Issues"
"Sports"
"Technology"
"Transport"
"Travel"

Titles:
\${titlesForCategory.join('\\n')}

Return ONLY a valid JSON array.

Each object must have exactly:
{
  "index": <0-based integer>,
  "category": "<one of the 21 categories above>"
}

Do not include explanations, markdown, comments, or any additional text.
\`;`;

code = code.replace(oldPromptBlock, newPromptBlock);
fs.writeFileSync('src/services/geminiService.ts', code);
