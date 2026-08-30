/**
 * Multi-Tier Model Waterfall for API Health Scanning
 * Ensures that if Attempt 1 fails (e.g. rate limit 429 or temporary outage),
 * Attempt 2 retries after a 5-second cooldown using a distinct model family.
 * Attempt 3 retries after another 5-second cooldown using a 3rd distinct model.
 */

export const SCAN_FALLBACK_MODELS = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3.7-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite'
] as const;

/**
 * Returns a human-friendly label for each model
 */
export function getModelDisplayName(modelId: string): string {
  switch (modelId) {
    case 'gemini-3.1-flash-lite-preview':
      return 'Gemini 3.1 Flash Lite';
    case 'gemini-3.7-flash':
      return 'Gemini 3.7 Flash';
    case 'gemini-2.5-flash':
      return 'Gemini 2.5 Flash';
    case 'gemini-2.5-flash-lite':
      return 'Gemini 2.5 Flash Lite';
    case 'gemini-3.6-flash':
      return 'Gemini 3.6 Flash';
    case 'gemini-3.5-flash-lite':
      return 'Gemini 3.5 Flash Lite';
    default:
      return modelId;
  }
}

/**
 * Resolves the model to use for a specific attempt number (1, 2, or 3).
 * Ensures attempt 1, attempt 2, and attempt 3 use 3 distinct model families.
 */
export function getAttemptModel(baseSelectedModel: string, attempt: number): string {
  const base = baseSelectedModel || 'gemini-3.1-flash-lite-preview';
  if (attempt <= 1) return base;

  // Build a distinct pool of 3 models starting with the selected base model
  const pool = [base];
  for (const m of SCAN_FALLBACK_MODELS) {
    if (!pool.includes(m)) {
      pool.push(m);
    }
  }

  if (attempt === 2) {
    return pool[1] || 'gemini-3.7-flash';
  }
  if (attempt === 3) {
    return pool[2] || 'gemini-2.5-flash';
  }

  return pool[(attempt - 1) % pool.length];
}

/**
 * Cleans and formats raw API error messages into clear, human-readable status text.
 */
export function formatScanErrorMessage(raw: string | undefined): string {
  if (!raw) return 'Failed to generate response';
  let str = String(raw).trim();

  // Try extracting inner message if JSON string
  try {
    const jsonMatch = str.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) {
        str = parsed.error.message;
      }
    }
  } catch (_) {}

  const lower = str.toLowerCase();

  if (str.includes('429') || str.includes('RESOURCE_EXHAUSTED') || lower.includes('quota') || lower.includes('rate limit')) {
    return 'Rate Limit / Quota Reached (429 RESOURCE_EXHAUSTED)';
  }
  if (str.includes('API_KEY_INVALID') || str.includes('API key not valid') || lower.includes('key not valid') || (str.includes('400') && lower.includes('key'))) {
    return 'Invalid or Revoked API Key (400 API_KEY_INVALID)';
  }
  if (str.includes('403') || str.includes('PERMISSION_DENIED') || lower.includes('permission denied')) {
    return 'Permission Denied / Key Restricted (403)';
  }
  if (str.includes('404') || str.includes('NOT_FOUND') || lower.includes('not found')) {
    return 'Model Endpoint Unavailable (404)';
  }
  if (str.includes('503') || str.includes('UNAVAILABLE') || lower.includes('service unavailable') || lower.includes('overloaded')) {
    return 'Gemini Service Temporarily Overloaded (503)';
  }

  // Strip excessive technical wrappers
  str = str.replace(/^\[GoogleGenAI Error\]:?\s*/i, '');
  str = str.replace(/^Error:\s*/i, '');

  return str.length > 80 ? `${str.substring(0, 77)}...` : str;
}
