import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { normalizeToSquare, cropFromSquare } from "../utils/imageUtils";
import { AspectRatio, MaskSettings } from "../types";

export const removeWatermark = async (
  base64Image: string,
  mimeType: string,
  originalWidth: number,
  originalHeight: number,
  ratio: AspectRatio,
  maskSettings: MaskSettings
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Возвращаемся к надежному текстовому промпту
  const prompt = "Remove the text, watermark, or object in the highlighted area. Reconstruct the background seamlessly to match the surrounding texture. High quality.";

  try {
    // 1. Prepare: Получаем ТОЛЬКО картинку (строку)
    const normalizedBase64 = await normalizeToSquare(
      base64Image,
      mimeType,
      ratio,
      maskSettings,
      originalWidth,
      originalHeight
    );

    // 2. Process: Отправляем одну картинку
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp", // Или gemini-1.5-flash
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: normalizedBase64,
              mimeType: mimeType,
            },
          },
        ],
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          // 3. Cleanup
          const result = await cropFromSquare(
            part.inlineData.data, 
            mimeType, 
            originalWidth, 
            originalHeight,
            ratio
          );
          return result;
        }
      }
    }
    throw new Error("No image data returned from AI.");
  } catch (err: any) {
    console.error("Gemini processing error:", err);
    throw new Error(`Failed to remove watermark: ${err.message || 'Unknown error'}`);
  }
};