import { GoogleGenAI } from "@google/genai";
import { AspectRatio, ImageResolution } from "../types";

// Default prompt provided by the user
export const DEFAULT_PROMPT = `Crie um logotipo ultra-realista e premium para a marca "ConexTV".
O design deve apresentar um visual metálico moderno com detalhes em prata cromada e ouro, bordas brilhantes e destaques suaves em neon.
Estilo: marca futurista de IPTV/tecnologia, reflexos de alta definição, gradientes suaves, flares de energia vibrantes.
O texto "Conex" deve ser em prata metálico com profundidade, e "TV" deve ser em ouro com um forte efeito 3D em relevo.
Adicione um ícone sutil de sinal sem fio acima do "V", integrado ao design.
Use iluminação de alto contraste, brilho cinematográfico, luz de fundo suave e contornos brilhantes.
Fundo: atmosfera escura e desfocada de estádio/tecnologia com feixes de luz, mas mantenha o logotipo como foco principal.
Resolução: 8K, extremamente nítido, sem distorções, espaçamento proporcional.
Referência de estilo: o logotipo original anexado (mesmo conceito geral, mas mais moderno, limpo e premium).`;

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

export const generateVideo = async (
  imageUrl: string,
  prompt: string
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please select a project.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Extract base64 data and mimeType from data URL
  const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid image data URL");
  }
  const mimeType = matches[1];
  const imageBytes = matches[2];

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      image: {
        imageBytes: imageBytes,
        mimeType: mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9',
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    if (operation.error) {
        throw new Error(`Video generation failed: ${operation.error.message}`);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("No video URI returned");
    }

    const videoResponse = await fetch(videoUri, {
        method: 'GET',
        headers: {
            'x-goog-api-key': apiKey,
        },
    });

    if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    return URL.createObjectURL(videoBlob);

  } catch (error: any) {
    console.error("Gemini Video API Error:", error);
    throw error;
  }
};