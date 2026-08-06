const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const oldStart = `    if (onProgress) onProgress("Getting specific categories...");`;

const oldEnd = `           console.warn("Failed to parse categories", e);
       }
    }

    return results;`;

const newStart = `    return results;
} catch (error: any) {`;

code = code.substring(0, code.indexOf(oldStart)) + `    return results;
  } catch (error: any) {` + code.substring(code.indexOf(newStart) + newStart.length);

const categoryFunction = `
export const generateCategoriesBatch = async (
  apiKey: string,
  items: { id: string; title: string }[],
  model: string,
  onProgress?: (progressMsg: string) => void
): Promise<Record<string, { category: string }>> => {
  const ai = new GoogleGenAI({ apiKey });
  
  if (onProgress) onProgress("Getting specific categories...");

  const titlesForCategory = items.map((item, index) => \`Index \${index}: \${item.title}\`);

  const categoryPromptText = \`
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
\`;

  try {
    const catResponse = await ai.models.generateContent({
      model,
      contents: categoryPromptText,
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

    const catText = catResponse.text;
    if (!catText) throw new Error("No response from AI");

    const results: Record<string, { category: string }> = {};

    let catArray;
    try {
        catArray = JSON.parse(catText);
    } catch (e) {
        throw new Error("Invalid JSON response from AI");
    }

    if (Array.isArray(catArray)) {
        catArray.forEach(catItem => {
            const idx = catItem.index;
            if (idx >= 0 && idx < items.length) {
                const originalId = items[idx].id;
                results[originalId] = { category: catItem.category || "" };
            }
        });
    }

    return results;

  } catch (error: any) {
    let msg = error.message || "Failed to generate categories";
    let code = 0;
    let status = "";
    if (error.error && typeof error.error === 'object') {
        if (error.error.message) msg = error.error.message;
        if (error.error.code) code = error.error.code;
        if (error.error.status) status = error.error.status;
    }
    
    // Attempt JSON parse of message if raw
    if (typeof msg === 'string' && msg.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(msg);
            if (parsed.error?.message) msg = parsed.error.message;
        } catch(e) {}
    }

    const lowerMsg = String(msg).toLowerCase();
    if (code === 429 || status === 'RESOURCE_EXHAUSTED' || lowerMsg.includes('quota') || lowerMsg.includes('429')) {
        throw new Error(\`QUOTA_EXCEEDED: \${msg}\`);
    }
    if (code === 400 || code === 403 || status === 'PERMISSION_DENIED' || lowerMsg.includes('key')) {
        throw new Error(\`INVALID_KEY: \${msg}\`);
    }

    throw new Error(msg);
  }
};
`;

code = code + categoryFunction;

fs.writeFileSync('src/services/geminiService.ts', code);
