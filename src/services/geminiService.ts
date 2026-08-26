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
  onProgress?: (progressMsg: string) => void,
  localKeys?: string[],
  isAdmin?: boolean,
  hasExplicitAdminGrant?: boolean
): Promise<Record<string, GeminiResponse>> => {
  if (onProgress) onProgress("Creating titles & keywords...");
  const res = await fetch('/api/central-generate', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
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
