export type AspectRatio = '9:16' | '4:5';

export interface MaskSettings {
  width: number; // Percentage of original width
  height: number; // Percentage of original height
  maskX: number; // Top-left X position as percentage of image width
  maskY: number; // Top-left Y position as percentage of image height
  feather: number; // Pixel radius for blur effect
  opacity: number; // Global opacity for the AI-generated layer (0 to 1)
  aspectRatio: AspectRatio;
}

export interface ImageInfo {
  dataURL: string;
  base64: string;
  mimeType: string;
  width: number;
  height: number;
  name?: string;
}

export interface BatchResult {
  original: ImageInfo;
  resultBase64: string;
}