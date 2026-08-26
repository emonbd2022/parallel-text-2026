import { GoogleGenAI, Type } from '@google/genai';

const AUTHORITATIVE_CATEGORIES = [
  "Animals",
  "Buildings and Architecture",
  "Business",
  "Drinks",
  "The Environment",
  "States of Mind",
  "Food",
  "Graphic Resources",
  "Hobbies and Leisure",
  "Industry",
  "Landscapes",
  "Lifestyle",
  "People",
  "Plants and Flowers",
  "Culture and Religion",
  "Science",
  "Social Issues",
  "Sports",
  "Technology",
  "Transport",
  "Travel"
];

export const generateCategoriesBatch = async (
  apiKey: string,
  items: { id: string; title: string }[],
  model: string,
  onProgress?: (progressMsg: string) => void,
  localKeys?: string[],
  isAdmin?: boolean,
  hasExplicitAdminGrant?: boolean
): Promise<Record<string, { category: string }>> => {
  if (onProgress) onProgress("Getting categories...");
  const res = await fetch('/api/central-category', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ items, model, virtualKeyId: apiKey, localKeys, isAdmin, hasExplicitAdminGrant })
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
};
export const parseAndValidateCategoryResponse = (catText: string, items: { id: string }[]): Record<string, { category: string }> => {
    const results: Record<string, { category: string }> = {};
    const catArray = JSON.parse(catText);

    if (!Array.isArray(catArray)) {
       throw new Error("INVALID_CATEGORY_RESPONSE: Expected an array from Gemini");
    }

    if (catArray.length !== items.length) {
       throw new Error(`INVALID_CATEGORY_RESPONSE: Expected ${items.length} results, but got ${catArray.length}`);
    }

    const seenIndices = new Set<number>();

    catArray.forEach(catItem => {
      const idx = catItem.index;
      
      if (typeof idx !== 'number' || idx < 0 || idx >= items.length) {
        throw new Error(`INVALID_CATEGORY_RESPONSE: Out of range or invalid index ${idx}`);
      }
      if (seenIndices.has(idx)) {
        throw new Error(`INVALID_CATEGORY_RESPONSE: Duplicate index ${idx} returned by Gemini`);
      }
      seenIndices.add(idx);

      let rawCategory = catItem.category;
      if (typeof rawCategory !== 'string') {
        throw new Error(`INVALID_CATEGORY_RESPONSE: Expected string for category at index ${idx}, got ${typeof rawCategory}`);
      }

      rawCategory = rawCategory.trim();
      if (rawCategory.startsWith('"') && rawCategory.endsWith('"') && rawCategory.length >= 2) {
        rawCategory = rawCategory.substring(1, rawCategory.length - 1).trim();
      } else if (rawCategory.startsWith("'") && rawCategory.endsWith("'") && rawCategory.length >= 2) {
        rawCategory = rawCategory.substring(1, rawCategory.length - 1).trim();
      }

      const normalizedInput = rawCategory.toLowerCase();
      const canonicalCategory = AUTHORITATIVE_CATEGORIES.find(c => c.toLowerCase() === normalizedInput);

      if (!canonicalCategory) {
         console.error(`[Category Error] Index: ${idx} Gemini Raw: ${catItem.category} Error: INVALID_CATEGORY`);
         throw new Error(`INVALID_CATEGORY: Index ${idx} returned unsupported category "${catItem.category}"`);
      }

      console.log(`[Category] Index: ${idx} Gemini Raw: ${catItem.category} Normalized: ${normalizedInput} Canonical: ${canonicalCategory}`);

      const originalId = items[idx].id;
      results[originalId] = { category: canonicalCategory };
    });

    if (seenIndices.size !== items.length) {
      for (let i = 0; i < items.length; i++) {
        if (!seenIndices.has(i)) {
          throw new Error(`INVALID_CATEGORY_RESPONSE: Missing category result for index ${i}`);
        }
      }
    }

    return results;
};

