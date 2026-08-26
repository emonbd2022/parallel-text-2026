import CryptoJS from 'crypto-js';

const CACHE_KEY = 'central_keys_encrypted_cache';
const SECRET = 'local_cache_secret_for_central_keys_998877';

export interface CentralKeyCache {
  keys: { id: string; key: string; label: string }[];
  lastUpdated: number;
}

export const getEncryptedCentralKeys = (): CentralKeyCache | null => {
  try {
    const encrypted = localStorage.getItem(CACHE_KEY);
    if (!encrypted) return null;
    const bytes = CryptoJS.AES.decrypt(encrypted, SECRET);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    if (decryptedData) {
      return JSON.parse(decryptedData) as CentralKeyCache;
    }
  } catch (e) {
    console.error('Failed to decrypt central keys from cache', e);
  }
  return null;
};

export const saveEncryptedCentralKeys = (keys: { id: string; key: string; label: string }[]) => {
  try {
    const data: CentralKeyCache = {
      keys,
      lastUpdated: Date.now()
    };
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), SECRET).toString();
    localStorage.setItem(CACHE_KEY, encrypted);
  } catch (e) {
    console.error('Failed to save encrypted central keys to cache', e);
  }
};

export const clearEncryptedCentralKeys = () => {
  localStorage.removeItem(CACHE_KEY);
};
