import { AspectRatio, MaskSettings } from '../types';

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        resolve(event.target.result);
      } else {
        reject(new Error("Failed to read file as Data URL."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const dataURLtoBase64 = (dataURL: string): string => {
  const parts = dataURL.split(',');
  return parts.length > 1 ? parts[1] : '';
};

export const dataURLtoMimeType = (dataURL: string): string => {
  const match = dataURL.match(/^data:(.*?);base64,/);
  return match ? match[1] : '';
};

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
    img.src = src;
  });
};

/**
 * Normalizes an image to a square 1:1.
 * Returns ONLY the image string (simpler, more stable).
 */
export const normalizeToSquare = async (
  base64: string,
  mimeType: string,
  ratio: AspectRatio,
  maskSettings: MaskSettings, // Оставляем аргумент для совместимости, даже если не используем глубоко
  originalWidth: number,
  originalHeight: number
): Promise<string> => {
  return new Promise(async (resolve) => {
    const img = await loadImage(`data:${mimeType};base64,${base64}`);
    const size = Math.max(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. White Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    // 2. Calculate Draw Position
    let drawX = 0;
    let drawY = 0;
    
    if (ratio === '4:5' && img.width < img.height) {
      // 4:5: Прижимаем влево (самое надежное для координат)
      drawX = 0;
      drawY = (size - img.height) / 2;
    } else {
      // Остальные: Центрируем
      drawX = (size - img.width) / 2;
      drawY = (size - img.height) / 2;
    }

    ctx.drawImage(img, drawX, drawY);
    resolve(dataURLtoBase64(canvas.toDataURL(mimeType)));
  });
};

/**
 * Reverse the normalization: Crop back to original.
 */
export const cropFromSquare = async (
  squareBase64: string,
  mimeType: string,
  targetWidth: number,
  targetHeight: number,
  ratio: AspectRatio
): Promise<string> => {
  return new Promise(async (resolve) => {
    const img = await loadImage(`data:${mimeType};base64,${squareBase64}`);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d')!;
    const size = img.width;

    let sourceX = 0;
    let sourceY = 0;
    
    if (ratio === '4:5' && targetWidth < targetHeight) {
      sourceX = 0; // Совпадает с normalizeToSquare
      sourceY = (size - targetHeight) / 2;
    } else {
      sourceX = (size - targetWidth) / 2;
      sourceY = (size - targetHeight) / 2;
    }

    ctx.drawImage(img, sourceX, sourceY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);
    resolve(dataURLtoBase64(canvas.toDataURL(mimeType)));
  });
};

export const drawMaskedImageOnCanvas = async (
  canvas: HTMLCanvasElement,
  originalImageInfo: { dataURL: string; width: number; height: number },
  aiResultBase64: string | null,
  maskSettings: MaskSettings,
): Promise<void> => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const originalImage = await loadImage(originalImageInfo.dataURL);
  canvas.width = originalImage.width;
  canvas.height = originalImage.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

  if (aiResultBase64) {
    try {
      const aiImage = await loadImage(`data:image/png;base64,${aiResultBase64}`);
      
      const maskPixelWidth = canvas.width * (maskSettings.width / 100);
      const maskPixelHeight = canvas.height * (maskSettings.height / 100);
      const maskPixelX = canvas.width * (maskSettings.maskX / 100);
      const maskPixelY = canvas.height * (maskSettings.maskY / 100);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      tempCtx.drawImage(aiImage, 0, 0, tempCanvas.width, tempCanvas.height);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) return;

      // Soft masking logic
      maskCtx.fillStyle = 'white';
      maskCtx.fillRect(maskPixelX, maskPixelY, maskPixelWidth, maskPixelHeight);

      if (maskSettings.feather > 0) {
        maskCtx.filter = `blur(${maskSettings.feather}px)`;
        maskCtx.drawImage(maskCanvas, 0, 0);
        maskCtx.filter = 'none'; // reset filter
      }

      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(maskCanvas, 0, 0);
      tempCtx.globalCompositeOperation = 'source-over';

      ctx.globalAlpha = maskSettings.opacity;
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.globalAlpha = 1;
    } catch (e) {
      console.error("Blending error:", e);
    }
  }
};