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
  }
): Promise<Record<string, GeminiResponse>> => {
  
  const ai = new GoogleGenAI({ apiKey });
  
  // Construct the multipart prompt
  // We feed images one by one, then a text prompt asking for a JSON array
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
    Generate Adobe Stock–ready metadata for EACH image in the exact order they were provided (Index 0 to ${items.length - 1}).

    For each image:
    1. Create a clear, descriptive title. ${transparencyDirective}
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
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
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

    // Process and Map results back to IDs
    const results: Record<string, GeminiResponse> = {};

    jsonArray.forEach((resItem) => {
       const index = resItem.index;
       if (index >= 0 && index < items.length) {
          const originalId = items[index].id;
          
          let title = resItem.title || "";
          let keywordsList = resItem.keywords || [];
          if (!Array.isArray(keywordsList)) keywordsList = String(keywordsList).split(',').map((s: string) => s.trim());

          // --- Post Processing (same as before) ---
          
          // Filter Negative Title
          if (config.negativeTitleWords) {
            const negatives = config.negativeTitleWords.split(',').map((w: string) => w.trim()).filter(Boolean);
            negatives.forEach((neg: string) => {
              const regex = new RegExp(`\\b${neg}\\b`, 'gi');
              title = title.replace(regex, '');
            });
            title = title.replace(/\s+/g, ' ').trim();
          }

          // Filter Negative Keywords
          if (config.negativeKeywords) {
            const negatives = config.negativeKeywords.split(',').map((w: string) => w.trim().toLowerCase()).filter(Boolean);
            keywordsList = keywordsList.filter((k: string) => {
              const lowerK = k.toLowerCase();
              return !negatives.some((neg: string) => lowerK.includes(neg));
            });
          }

          // Apply Prefix / Suffix
          if (config.titlePrefix) title = `${config.titlePrefix.trim()} ${title}`;
          if (config.titleSuffix) title = `${title} ${config.titleSuffix.trim()}`;

          results[originalId] = {
            title: title.trim(),
            keywords: keywordsList.join(', ')
          };
       }
    });

    return results;

  } catch (error: any) {
    // Error handling logic reused from previous version
    console.error("Gemini API Error:", error);
    let msg = error.message || "Failed to generate metadata";
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
        throw new Error(`QUOTA_EXCEEDED: ${msg}`);
    }
    if (code === 400 || code === 403 || status === 'PERMISSION_DENIED' || lowerMsg.includes('key')) {
        throw new Error(`INVALID_KEY: ${msg}`);
    }

    throw new Error(msg);
  }
};
