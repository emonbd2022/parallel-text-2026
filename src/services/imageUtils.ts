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

// Singleton Web Worker instance for off-thread image processing
let imageWorkerInstance: Worker | null = null;
let imageWorkerAvailable = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
let workerTaskId = 0;
const pendingWorkerTasks = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getImageWorker(): Worker | null {
  if (!imageWorkerAvailable) return null;
  if (!imageWorkerInstance) {
    try {
      imageWorkerInstance = new Worker(
        new URL('../workers/imageWorker.ts', import.meta.url),
        { type: 'module' }
      );
      imageWorkerInstance.onmessage = (e: MessageEvent) => {
        const { id, success, buffer, mimeType, error } = e.data;
        const task = pendingWorkerTasks.get(id);
        if (!task) return;
        pendingWorkerTasks.delete(id);

        if (success && buffer) {
          const blob = new Blob([buffer], { type: mimeType });
          task.resolve(blob);
        } else {
          task.reject(new Error(error || 'Worker image compression failed'));
        }
      };
      imageWorkerInstance.onerror = (err) => {
        console.warn('Image worker encountered an error, falling back to main-thread canvas:', err);
        imageWorkerAvailable = false;
        // Reject all pending tasks to trigger fallback
        for (const [id, task] of pendingWorkerTasks.entries()) {
          task.reject(new Error('Worker error'));
        }
        pendingWorkerTasks.clear();
      };
    } catch (err) {
      console.warn('Unable to initialize image Web Worker, using main-thread canvas:', err);
      imageWorkerAvailable = false;
      return null;
    }
  }
  return imageWorkerInstance;
}

/**
 * Compresses an image client-side to be under a target size (default 50KB).
 * Executes off-thread via Web Worker + OffscreenCanvas where supported.
 * Falls back to DOM Canvas if SVG or if OffscreenCanvas/Worker is not supported.
 */
export const compressImage = async (
  file: File, 
  targetSizeKB = 50
): Promise<{ blob: Blob; dataUrl: string | null }> => {
  // Quick check for EPS or other non-web formats
  if (file.name.toLowerCase().endsWith('.eps')) {
    return { blob: file, dataUrl: null };
  }

  const isSvg = file.type.includes('svg') || file.name.toLowerCase().endsWith('.svg');
  const isTransparent = isSvg || file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
  const outputMime = isTransparent ? 'image/webp' : 'image/jpeg';

  // Strategy 1: Attempt OffscreenCanvas Web Worker execution (non-SVG raster images)
  const worker = getImageWorker();
  if (worker && !isSvg && typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      const taskId = `img_${++workerTaskId}_${Date.now()}`;
      
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        pendingWorkerTasks.set(taskId, { resolve, reject });
        worker.postMessage(
          {
            id: taskId,
            imageBitmap: bitmap,
            mimeType: outputMime,
            quality: 0.6,
            maxDim: 800,
            targetSizeKB
          },
          [bitmap]
        );
      });

      const finalDataUrl = await fileToDataURL(compressedBlob);
      return { blob: compressedBlob, dataUrl: finalDataUrl };
    } catch (workerErr) {
      console.warn('Off-thread worker compression notice, falling back to main thread canvas:', workerErr);
    }
  }

  // Strategy 2: Main-thread Canvas fallback (handles SVG rasterization and worker fallbacks)
  const dataUrlOriginal = await fileToDataURL(file);
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

  let maxDim = 800;
  let quality = 0.6;
  let blob: Blob | null = null;
  let attempts = 0;

  while (attempts < 3) {
    let width = img.width;
    let height = img.height;

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

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const resultBlob = await new Promise<Blob | null>((resolve) => 
      canvas.toBlob(resolve, outputMime, quality)
    );

    if (!resultBlob) throw new Error('Compression failed');

    if (resultBlob.size <= targetSizeKB * 1024 || attempts === 2) {
      blob = resultBlob;
      break;
    }

    maxDim = Math.round(maxDim * 0.8);
    quality = quality * 0.8;
    attempts++;
  }

  if (!blob) return { blob: file, dataUrl: null };

  const finalDataUrl = await fileToDataURL(blob);
  return { blob, dataUrl: finalDataUrl };
};
