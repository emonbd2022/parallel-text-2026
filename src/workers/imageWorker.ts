// Web Worker for off-thread image processing and compression
// Moves CPU-heavy pixel manipulation and image compression off the main thread

self.onmessage = async (e: MessageEvent) => {
  const { id, imageBitmap, mimeType, quality, maxDim, targetSizeKB } = e.data;

  try {
    let width = imageBitmap.width;
    let height = imageBitmap.height;

    if (width === 0 || height === 0) {
      width = 1024;
      height = 1024;
    }

    let currentMaxDim = maxDim || 800;
    let currentQuality = quality || 0.6;
    let attempts = 0;
    let resultBlob: Blob | null = null;

    while (attempts < 3) {
      let targetW = width;
      let targetH = height;

      if (targetW > currentMaxDim || targetH > currentMaxDim) {
        const ratio = Math.min(currentMaxDim / targetW, currentMaxDim / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }

      const offscreen = new OffscreenCanvas(targetW, targetH);
      const ctx = offscreen.getContext('2d');
      if (!ctx) throw new Error('Could not get OffscreenCanvas 2D context');

      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(imageBitmap, 0, 0, targetW, targetH);

      resultBlob = await offscreen.convertToBlob({
        type: mimeType || 'image/webp',
        quality: currentQuality,
      });

      if (resultBlob.size <= (targetSizeKB || 50) * 1024 || attempts === 2) {
        break;
      }

      currentMaxDim = Math.round(currentMaxDim * 0.8);
      currentQuality = currentQuality * 0.8;
      attempts++;
    }

    // Close the original ImageBitmap to free GPU/RAM memory immediately
    imageBitmap.close();

    if (!resultBlob) {
      throw new Error('Image compression produced null blob');
    }

    // Convert to ArrayBuffer for zero-copy transfer
    const arrayBuffer = await resultBlob.arrayBuffer();

    (self as any).postMessage(
      {
        id,
        success: true,
        buffer: arrayBuffer,
        mimeType: resultBlob.type,
        size: resultBlob.size,
      },
      [arrayBuffer]
    );
  } catch (error: any) {
    if (imageBitmap && typeof imageBitmap.close === 'function') {
      try { imageBitmap.close(); } catch {}
    }
    self.postMessage({
      id,
      success: false,
      error: error?.message || 'Compression worker error',
    });
  }
};
