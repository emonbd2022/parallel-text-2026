/**
 * Converts a File or Blob to a Base64 Data URL.
 */
export const fileToDataURL = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Helper to convert Base64 DataURI back to Blob for restoration from storage.
 */
export const dataURItoBlob = (dataURI: string): Blob => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};

/**
 * Compresses an image client-side to be under a target size (default 50KB).
 * Handles SVG by drawing to canvas (rasterizing).
 * Handles EPS/Others by returning original if render fails (fallback).
 */
export const compressImage = async (
  file: File, 
  targetSizeKB = 50
): Promise<{ blob: Blob; dataUrl: string | null }> => {
  // Load original
  const dataUrlOriginal = await fileToDataURL(file);
  
  // Quick check for EPS or other non-web formats
  if (file.name.toLowerCase().endsWith('.eps')) {
      // Browsers can't render EPS. Return original blob and null thumb.
      return { blob: file, dataUrl: null };
  }

  const img = new Image();
  
  try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrlOriginal;
      });
  } catch (e) {
      console.warn("Could not render image preview (likely unsupported format)", file.name);
      return { blob: file, dataUrl: null };
  }

  // Determine output format
  // For SVG, we must convert to PNG/WEBP/JPG to be usable by Gemini (which doesn't parse SVG text well visually)
  const isSvg = file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg');
  const isTransparent = isSvg || file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
  
  // Prefer WEBP for efficiency, JPEG for photos
  const outputMime = isTransparent ? 'image/webp' : 'image/jpeg';

  let maxDim = 800;
  let quality = 0.6;
  let blob: Blob | null = null;
  let attempts = 0;

  while (attempts < 3) {
    let width = img.width;
    let height = img.height;
    
    // Safety check for vector (SVG) without defined dims
    if (width === 0 || height === 0) {
        width = 1024; 
        height = 1024;
    }

    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    // Clear rect
    ctx.clearRect(0, 0, width, height);
    
    // Draw
    ctx.drawImage(img, 0, 0, width, height);

    const resultBlob = await new Promise<Blob | null>((resolve) => 
      canvas.toBlob(resolve, outputMime, quality)
    );

    if (!resultBlob) throw new Error('Compression failed');

    // Check size
    if (resultBlob.size <= targetSizeKB * 1024 || attempts === 2) {
      blob = resultBlob;
      break;
    }

    // Reduce parameters
    maxDim = Math.round(maxDim * 0.8);
    quality = quality * 0.8;
    attempts++;
  }

  if (!blob) return { blob: file, dataUrl: null };

  // Create preview URL from final blob
  const finalDataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob!);
  });

  return { blob, dataUrl: finalDataUrl };
};
