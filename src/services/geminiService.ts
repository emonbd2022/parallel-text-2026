import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse } from "../types";

interface BatchItem {
  id: string;
  base64Image: string;
}

export const generateMetadataBatch = async (
  apiKey: string,
  items: BatchItem[],
  config: {
    model: string;
    titleMaxLen: number;
    keywordsCount: number;
    titlePrefix?: string;
    titleSuffix?: string;
    negativeTitleWords?: string;
    negativeKeywords?: string;
    forceTransparency?: boolean;
  },
  onProgress?: (progressMsg: string) => void
): Promise<Record<string, GeminiResponse>> => {
  const ai = new GoogleGenAI({ apiKey });
  
  if (onProgress) onProgress("Creating titles & keywords...");

  const promptParts: any[] = [];
  items.forEach((item, index) => {
    const base64Data = item.base64Image.split(',')[1];
    const mimeType = item.base64Image.substring(item.base64Image.indexOf(':') + 1, item.base64Image.indexOf(';'));
    
    promptParts.push({ inlineData: { mimeType, data: base64Data } });
  });

  const transparencyDirective = config.forceTransparency
    ? `Each image contains a subject isolated on a transparent background. You MUST explicitly include the exact phrase "isolated on transparent background" in the title for every image.`
    : `Analyze the background of each image carefully.
       - If an image background is transparent, you MUST include "isolated on transparent background" in the title.
       - If an image background is solid white, you MUST include "isolated on white background" in the title.`;

  const promptText = `
    I have provided ${items.length} image(s). 
    Generate Adobe Stock-ready metadata for EACH image in the exact order they were provided (Index 0 to ${items.length - 1}).

    For each image:
    1. Create a highly commercial and descriptive title containing highly searched keywords.
        - The title MUST consist of 1 to 2 complete sentences.
        - The first sentence should vividly describe the main subject, setting, action, and lighting (e.g., "Grain pouring into a large pile in a warehouse.").
       - The final sentence MUST suggest a practical use case or conceptual theme for the image (e.g., "Food supply concept for industrial trade ads.").
       - ${transparencyDirective}
       - CRITICAL: The ENTIRE title MUST be precise, using a maximum of 25 words, and strictly UNDER ${config.titleMaxLen || 180} characters in length (including spaces). Be extremely concise.

    2. Produce exactly ${config.keywordsCount} accurate, SEO-friendly keywords optimized for Adobe Stock sales.
       - Focus on conceptual terms, emotions, setting, lighting, and specific subject details.
       - Include synonyms and related concepts that buyers might search for.
       - Avoid generic or irrelevant terms.
       - ORDER them strictly by relevance and visual importance—from most critical to least important. The first 10 keywords dictate search ranking and MUST be the strongest descriptors. DO NOT sort the keywords alphabetically. Exclude all trademarks.
    
    Return a strictly valid JSON array where each object contains:
    - "index": integer (0-based index corresponding to the input order)
    - "title": string
    - "keywords": array of strings
  `;

  promptParts.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: config.model,
      contents: { parts: promptParts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              title: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["index", "title", "keywords"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    let jsonArray: any[];
    try {
        jsonArray = JSON.parse(text);
        if (!Array.isArray(jsonArray)) throw new Error("AI did not return an array");
    } catch (e) {
        throw new Error("Invalid JSON response from AI");
    }
    
    const results: Record<string, GeminiResponse> = {};
    
    jsonArray.forEach((resItem) => {
       const index = resItem.index;
       if (index >= 0 && index < items.length) {
          const originalId = items[index].id;
          
          let title = resItem.title || "";
          let keywordsList = resItem.keywords || [];

          if (!Array.isArray(keywordsList)) keywordsList = String(keywordsList).split(',').map((s: string) => s.trim());

          if (config.negativeTitleWords) {
            const negatives = config.negativeTitleWords.split(',').map((w: string) => w.trim()).filter(Boolean);
            negatives.forEach((neg: string) => {
              const regex = new RegExp(`\\b${neg}\\b`, 'gi');
              title = title.replace(regex, '');
            });
            title = title.replace(/\s+/g, ' ').trim();
          }

          if (config.negativeKeywords) {
            const negatives = config.negativeKeywords.split(',').map((w: string) => w.trim().toLowerCase()).filter(Boolean);
            keywordsList = keywordsList.filter((k: string) => {
              const lowerK = k.toLowerCase();
              return !negatives.some((neg: string) => lowerK.includes(neg));
            });
          }

          if (config.titlePrefix) title = `${config.titlePrefix.trim()} ${title}`;
          if (config.titleSuffix) title = `${title} ${config.titleSuffix.trim()}`;
          
          let finalTitle = title.trim();
          const maxLen = config.titleMaxLen || 180;
          if (finalTitle.length > maxLen) {
              let truncated = finalTitle.substring(0, maxLen - 1);
              const lastSpace = truncated.lastIndexOf(' ');
              if (lastSpace > 0) {
                  truncated = truncated.substring(0, lastSpace);
              }
              finalTitle = truncated.replace(/[\s,.;:-]+$/, '') + '.';
          }

          const maxKeywords = 45;
          if (keywordsList.length > maxKeywords) {
              keywordsList = keywordsList.slice(0, maxKeywords);
          }

          results[originalId] = {
            title: finalTitle,
            keywords: keywordsList.join(', '),
            category: ""
          };
       }
    });
    
    return results;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let msg = error.message || "Failed to generate metadata";
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

export const generateCategoriesBatch = async (
  apiKey: string,
  items: { id: string; title: string }[],
  model: string,
  onProgress?: (progressMsg: string) => void
): Promise<Record<string, { category: string }>> => {
  const ai = new GoogleGenAI({ apiKey });
  
  if (onProgress) onProgress("Getting specific categories...");

  const titlesForCategory = items.map((item, index) => `Index ${index}: ${item.title}`);

  const categoryPromptText = `
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

    let catArray;
    try {
        catArray = JSON.parse(catText);
    } catch (e) {
        throw new Error("Invalid JSON response from AI");
    }

    let finalArray = catArray;
    
    // SECOND PASS: Re-check the categories
    if (Array.isArray(catArray) && catArray.length > 0) {
        if (onProgress) onProgress("Verifying categories...");
        const verificationPromptText = `You are a Senior Quality Assurance reviewer for Adobe Stock categories.
Review the following list of titles and their assigned categories. 
If a category is incorrect based on the title's primary subject, correct it. Be very careful to distinguish between "Industry" and "Food".

Only use one of the following exact categories:
"Animals", "Buildings and Architecture", "Business", "Drinks", "The Environment", "States of Mind", "Food", "Graphic Resources", "Hobbies and Leisure", "Industry", "Landscapes", "Lifestyle", "People", "Plants and Flowers", "Culture and Religion", "Science", "Social Issues", "Sports", "Technology", "Transport", "Travel"

Items to review:
${catArray.map(c => `Index ${c.index}: Title: "${items[c.index]?.title}", Proposed Category: "${c.category}"`).join('\n')}

Return ONLY a valid JSON array of objects, with:
{ "index": <0-based integer>, "category": "<the verified or corrected category>" }
`;
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
