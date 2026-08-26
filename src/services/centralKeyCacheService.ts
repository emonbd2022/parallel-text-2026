/**
 * Central API Key Cache Service
 * As per policy: Central API keys are NEVER stored or cached in localStorage/sessionStorage.
 * They are purely fetched into in-memory state on demand when the user selects Central API mode.
 */

const CACHE_KEY = 'central_keys_encrypted_cache';

export interface CentralKeyCache {
  keys: { id: string; key: string; label: string }[];
  lastUpdated: number;
}

// Ensure any previously stored central keys are immediately cleared from persistent storage
export const clearEncryptedCentralKeys = () => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch (e) {
    console.warn('Failed to clear central keys storage', e);
  }
};

// Immediate cleanup on load
clearEncryptedCentralKeys();

// Central keys are NOT read from local storage
export const getEncryptedCentralKeys = (): CentralKeyCache | null => {
  clearEncryptedCentralKeys();
  return null;
};

// No-op to prevent writing central keys to localStorage
export const saveEncryptedCentralKeys = (_keys: { id: string; key: string; label: string }[]) => {
  clearEncryptedCentralKeys();
};
