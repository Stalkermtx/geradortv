import { GoogleGenAI } from "@google/genai";
import { AspectRatio, ImageResolution } from "../types";

// Default prompt provided by the user
export const DEFAULT_PROMPT = `Create an ultra-realistic premium logo for the brand "ConexTV".
The design should feature a modern metallic look with chromed silver and gold accents, glowing edges, and soft neon highlights.
Style: futuristic IPTV/tech brand, high-definition reflections, smooth gradients, vibrant energy flares.
The text "Conex" should be metallic silver with depth, and "TV" should be in gold with a strong 3D embossed effect.
Add a subtle wireless signal icon above the "V", integrated into the design.
Use high-contrast lighting, cinematic glow, soft backlight rim, and glossy contours.
Background: dark blurred stadium/tech atmosphere with light streaks, but keep the logo as the main focus.
Resolution: 8K, extremely sharp, no distortions, proportional spacing.
Style reference: the original logo attached (same overall concept but more modern, cleaner, and more premium).`;

export const checkApiKey = async (): Promise<boolean> => {
  if (window.aistudio) {
    return await window.aistudio.hasSelectedApiKey();
  }
  return false;
};

export const promptForApiKey = async (): Promise<void> => {
  if (window.aistudio) {
    await window.aistudio.openSelectKey();
  } else {
    console.error("AI Studio environment not detected.");
  }
};

export const generateImage = async (
  prompt: string,
  aspectRatio: AspectRatio,
  resolution: ImageResolution
): Promise<string> => {
  // Always create a new instance to ensure the latest API Key is used
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please select a project.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: resolution,
        },
      },
    });

    let imageUrl = '';
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          // Determine mimeType if available, defaulting to png if not explicitly returned in a way we can parse easily
          // The API usually returns proper mimeType in inlineData
          const mimeType = part.inlineData.mimeType || 'image/png';
          imageUrl = `data:${mimeType};base64,${base64EncodeString}`;
          break; // Found the image, stop searching
        }
      }
    }

    if (!imageUrl) {
      throw new Error("No image data found in response");
    }

    return imageUrl;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Enhance error message if it's a permission issue or quota
    if (error.message && error.message.includes("403")) {
      throw new Error("Access denied. Please check your API key permissions and ensure the API is enabled.");
    }
    throw error;
  }
};