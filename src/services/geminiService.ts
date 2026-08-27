import { GoogleGenAI, Type } from "@google/genai";
import { auth } from '../lib/firebase';
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
  onProgress?: (progressMsg: string) => void,
  localKeys?: string[],
  isAdmin?: boolean,
  hasExplicitAdminGrant?: boolean
): Promise<Record<string, GeminiResponse>> => {
  if (apiKey.startsWith('central-') || !apiKey.startsWith('AIza')) {
    if (onProgress) onProgress("Creating titles & keywords (Central)...");
    const res = await fetch('/api/central-generate', {
       method: 'POST',
       
       headers: { 
         'Content-Type': 'application/json',
         ...(auth?.currentUser ? { 'Authorization': `Bearer ${await auth.currentUser.getIdToken()}` } : {})
       },
       body: JSON.stringify({ items, config, virtualKeyId: apiKey, localKeys, isAdmin, hasExplicitAdminGrant })
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error("Central API backend routing error: production endpoint returned HTML instead of JSON.");
    }
    if (!res.ok) {
        let errMsg = await res.text();
        try {
            const errObj = JSON.parse(errMsg);
            if (errObj.error) errMsg = errObj.error;
        } catch {}
        throw new Error(errMsg || `Server error ${res.status}`);
    }
    if (!contentType.includes('application/json')) {
      throw new Error(`Invalid response format from Central API (received ${contentType || 'unknown'}). Expected JSON.`);
    }
    return await res.json();
  }

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

  const systemInstruction = `You are an expert Adobe Stock contributor and metadata creator.
Your goal is to generate Adobe Stock-ready metadata for the provided images.

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
   - ORDER them strictly by relevance and visual importance—from most critical to least important. The first 10 keywords dictate search ranking and MUST be the strongest descriptors. DO NOT sort the keywords alphabetically. Exclude all trademarks.`;

  const promptText = `I have provided ${items.length} image(s).
Generate Adobe Stock-ready metadata for EACH image in the exact order they were provided (Index 0 to ${items.length - 1}).

Return a strictly valid JSON array where each object contains:
- "index": integer (0-based index corresponding to the input order)
- "title": string
- "keywords": array of strings`;

  promptParts.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: config.model,
      contents: { parts: promptParts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              index: { type: Type.INTEGER },
              title: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              category: { type: Type.STRING }
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

/**
 * Validates a Gemini API key by sending a genuine live request to the models endpoint.
 * Returns { valid: boolean; error?: string }
 */
export async function validateGeminiApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  const clean = apiKey.trim();
  if (clean.startsWith('central-') || !clean.startsWith('AIza')) {
    return { valid: true };
  }
  if (!clean || clean.length < 15 || clean === 'abc' || clean === 'xyz' || clean.toLowerCase().includes('demo') || clean.toLowerCase().includes('test')) {
    return { valid: false, error: 'Invalid API key format or demo placeholder.' };
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(clean)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.models) && data.models.length > 0) {
        return { valid: true };
      }
    }
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || `Google API returned status ${res.status} (${res.statusText})`;
    return { valid: false, error: msg };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Network error while validating key' };
  }
}
