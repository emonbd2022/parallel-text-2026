import { GoogleGenAI, Type } from '@google/genai';

export const generateCategoriesBatch = async (
  apiKey: string,
  items: { id: string; title: string }[],
  model: string,
  onProgress?: (progressMsg: string) => void
): Promise<Record<string, { category: string }>> => {
  const ai = new GoogleGenAI({ apiKey });
  
  if (onProgress) onProgress("Getting categories...");

  const titlesForCategory = items.map((item, index) => `Index ${index}: ${item.title}`);

  const categoryPromptText = `
You are an expert Adobe Stock content reviewer.

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
${titlesForCategory.join('\n')}

Return ONLY a valid JSON array.

Each object must have exactly:
{
  "index": <0-based integer>,
  "category": "<one of the 21 categories above>"
}

Do not include explanations, markdown, comments, or any additional text.
`;

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
    const catArray = JSON.parse(catText);

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
    
    if (typeof msg === 'string' && msg.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(msg);
            if (parsed.error?.message) msg = parsed.error.message;
        } catch(e) {}
    }

    const lowerMsg = String(msg).toLowerCase();
    if (code === 429 || status === 'RESOURCE_EXHAUSTED' || lowerMsg.includes('quota') || lowerMsg.includes('429')) {
        throw new Error(`QUOTA_EXCEEDED: ${msg}`);
    }
    if (code === 400 || code === 403 || status === 'PERMISSION_DENIED' || lowerMsg.includes('key')) {
        throw new Error(`INVALID_KEY: ${msg}`);
    }

    throw new Error(msg);
  }
};
