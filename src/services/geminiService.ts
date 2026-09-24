import { GoogleGenAI, Type } from "@google/genai";
import { GeminiResponse } from "../types";

interface BatchItem {
  id: string;
  base64Image: string;
}

export function postProcessMetadataItem(
  rawItem: { title?: string; keywords?: any; category?: string },
  config: {
    titleMaxLen: number;
    keywordsCount: number;
    titlePrefix?: string;
    titleSuffix?: string;
    negativeTitleWords?: string;
    negativeKeywords?: string;
  }
): GeminiResponse {
  let title = (rawItem.title || "").trim();
  let keywordsList = rawItem.keywords || [];
  if (!Array.isArray(keywordsList)) {
    keywordsList = String(keywordsList).split(',').map((s: string) => s.trim()).filter(Boolean);
  }

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

  const targetKeywordsCount = Math.min(config.keywordsCount || 25, 45);
  if (keywordsList.length > targetKeywordsCount) {
      keywordsList = keywordsList.slice(0, targetKeywordsCount);
  }

  return {
    title: finalTitle,
    keywords: keywordsList.join(', '),
    category: rawItem.category || ""
  };
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
  hasExplicitAdminGrant?: boolean,
  signal?: AbortSignal
): Promise<Record<string, GeminiResponse>> => {
  const isCentral = apiKey.startsWith('central-') || apiKey.startsWith('virtual-') || apiKey === 'central_pool' || (apiKey.length < 20 && !apiKey.startsWith('AIza') && !apiKey.startsWith('AQ.'));
  if (isCentral) {
    if (onProgress) onProgress("Creating titles & keywords (Central)...");
    
    // Attempt to get auth token and device ID for server-side enforcement
    let token = '';
    let deviceId = '';
    try {
      const { auth } = await import('../lib/firebase');
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
      deviceId = localStorage.getItem('parrarel_device_id_v2') || '';
    } catch (e) {}

    const res = await fetch('/api/central-generate', {
       method: 'POST',
       signal,
       headers: { 
         'Content-Type': 'application/json',
         ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
         ...(deviceId ? { 'X-Device-Id': deviceId } : {})
       },
       body: JSON.stringify({ items, config, virtualKeyId: apiKey, localKeys, isAdmin: isAdmin ?? true, hasExplicitAdminGrant: true })
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error("Central API backend routing error: production endpoint returned HTML instead of JSON.");
    }
    if (!res.ok) {
        let errMsg = await res.text();
        try {
            const errObj = JSON.parse(errMsg);
            if (errObj.message) {
              errMsg = errObj.message;
            } else if (errObj.error) {
              errMsg = errObj.error;
            }
        } catch {}
        throw new Error(errMsg || `Server error ${res.status}`);
    }
    if (!contentType.includes('application/json')) {
      throw new Error(`Invalid response format from Central API (received ${contentType || 'unknown'}). Expected JSON.`);
    }
    const rawCentralResults: Record<string, any> = await res.json();
    const processedCentralResults: Record<string, GeminiResponse> = {};
    for (const [id, val] of Object.entries(rawCentralResults)) {
      processedCentralResults[id] = postProcessMetadataItem(val, config);
    }
    return processedCentralResults;
  }

  const ai = new GoogleGenAI({ apiKey });
  
  if (onProgress) onProgress("Creating titles & keywords...");

  const promptParts: any[] = [];
  items.forEach((item) => {
    let base64Data = item.base64Image;
    let mimeType = 'image/jpeg';
    if (item.base64Image.includes(';base64,')) {
      const splitParts = item.base64Image.split(';base64,');
      mimeType = splitParts[0].replace(/^data:/, '') || 'image/jpeg';
      base64Data = splitParts[1];
    } else if (item.base64Image.startsWith('data:')) {
      const commaIdx = item.base64Image.indexOf(',');
      if (commaIdx !== -1) {
        mimeType = item.base64Image.substring(5, commaIdx).split(';')[0] || 'image/jpeg';
        base64Data = item.base64Image.substring(commaIdx + 1);
      }
    }
    
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

  const candidateModels = [
    config.model || 'gemini-2.5-flash',
    ...(config.model !== 'gemini-2.5-flash' ? ['gemini-2.5-flash'] : []),
    ...(config.model !== 'gemini-2.5-flash-lite' ? ['gemini-2.5-flash-lite'] : []),
    ...(config.model !== 'gemini-3.8-flash' ? ['gemini-3.8-flash'] : []),
    ...(config.model !== 'gemini-3.5-flash' ? ['gemini-3.5-flash'] : [])
  ];

  let response: any = null;
  let lastError: any = null;

  for (const candidateModel of candidateModels) {
    if (signal?.aborted) throw new Error("Operation aborted by user");
    
    // Per-attempt timeout of 25 seconds to prevent hanging on preview models
    const attemptAbortController = new AbortController();
    const timeoutId = setTimeout(() => attemptAbortController.abort(), 25000);
    
    let combinedSignal: AbortSignal = attemptAbortController.signal;
    if (signal) {
      if (typeof (AbortSignal as any).any === 'function') {
        combinedSignal = (AbortSignal as any).any([signal, attemptAbortController.signal]);
      } else {
        const c = new AbortController();
        const onAbort = () => c.abort();
        signal.addEventListener('abort', onAbort, { once: true });
        attemptAbortController.signal.addEventListener('abort', onAbort, { once: true });
        combinedSignal = c.signal;
      }
    }

    try {
      response = await ai.models.generateContent({
        model: candidateModel,
        contents: promptParts,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          abortSignal: combinedSignal,
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
      clearTimeout(timeoutId);
      if (response?.text) break;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
      if (signal?.aborted) throw err;
      console.warn(`[Local Gemini] Model ${candidateModel} failed, trying fallback:`, err?.message || err);
      continue;
    }
  }

  try {
    if (!response?.text) {
      throw lastError || new Error("No response from AI");
    }

    const text = response.text;
    let cleanText = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = cleanText.match(/\[[\s\S]*\]/);
    if (match) cleanText = match[0];

    let jsonArray: any[];
    try {
        jsonArray = JSON.parse(cleanText);
        if (!Array.isArray(jsonArray)) throw new Error("AI did not return an array");
    } catch (e) {
        throw new Error("Invalid JSON response from AI");
    }
    
    const results: Record<string, GeminiResponse> = {};
    
    jsonArray.forEach((resItem) => {
       const index = resItem.index;
       if (index >= 0 && index < items.length) {
          const originalId = items[index].id;
          results[originalId] = postProcessMetadataItem(resItem, config);
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
    if (code === 403 || status === 'PERMISSION_DENIED' || lowerMsg.includes('api_key_invalid') || lowerMsg.includes('key not valid') || lowerMsg.includes('invalid api key')) {
        throw new Error(`INVALID_KEY: ${msg}`);
    }
    if (lowerMsg.includes('unable to process input image') || lowerMsg.includes('invalid_argument')) {
        throw new Error(`IMAGE_ERROR: ${msg}`);
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
