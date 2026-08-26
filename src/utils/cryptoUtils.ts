const SECRET_KEY = import.meta.env.VITE_CENTRAL_API_SECRET_KEY || 'development_secret_key_needs_32_bytes!';

const getCryptoKey = async () => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SECRET_KEY);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
};

const fromHex = (hex: string) => new Uint8Array(hex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');

export const encryptClientSide = async (text: string): Promise<string> => {
  try {
    const cryptoKey = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);
    
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      encoded
    );
    
    // Web Crypto appends the 16-byte auth tag at the end of the ciphertext
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const authTag = encryptedArray.slice(-16);
    const ciphertext = encryptedArray.slice(0, -16);
    
    return `${toHex(iv.buffer)}:${toHex(authTag.buffer)}:${toHex(ciphertext.buffer)}`;
  } catch (e) {
    console.error("Client encrypt error", e);
    return "";
  }
};

export const decryptClientSide = async (encText: string): Promise<string> => {
  try {
    if (!encText || !encText.includes(':')) {
      // Fallback for plaintext keys that might have been stored raw or AIza...
      return encText;
    }
    const cryptoKey = await getCryptoKey();
    const [ivHex, authTagHex, encryptedHex] = encText.split(':');
    
    const iv = fromHex(ivHex);
    const authTag = fromHex(authTagHex);
    const encrypted = fromHex(encryptedHex);
    
    const combined = new Uint8Array(encrypted.length + authTag.length);
    combined.set(encrypted);
    combined.set(authTag, encrypted.length);
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      cryptoKey,
      combined
    );
    
    return new TextDecoder().decode(decryptedBuffer);
  } catch (e) {
    // Return original if decryption fails (might be raw key)
    return encText;
  }
};
