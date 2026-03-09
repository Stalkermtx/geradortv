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
  if (import.meta.env.VITE_GEMINI_API_KEY) {
    return true;
  }
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
  // Try to use the selected key, otherwise fall back to the environment key
  // The platform injects process.env.API_KEY dynamically
  // @ts-ignore
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chave API não encontrada. Por favor, selecione um projeto.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  let attempt = 0;
  const maxRetries = 3;
  
  while (attempt < maxRetries) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
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
            const mimeType = part.inlineData.mimeType || 'image/png';
            imageUrl = `data:${mimeType};base64,${base64EncodeString}`;
            break; 
          }
        }
      }

      if (!imageUrl) {
        throw new Error("Nenhum dado de imagem encontrado na resposta");
      }

      return imageUrl;

    } catch (error: any) {
      console.error(`Gemini API Error (Attempt ${attempt + 1}/${maxRetries}):`, error);
      
      // Handle 503 Service Unavailable (High Demand)
      if (error.message && (error.message.includes("503") || error.message.includes("high demand"))) {
        attempt++;
        if (attempt < maxRetries) {
          // Wait with exponential backoff: 2s, 4s, 8s
          const delay = 2000 * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        } else {
           throw new Error("O sistema está com alta demanda momentânea. Por favor, aguarde alguns instantes e tente novamente.");
        }
      }

      // Enhance error message if it's a permission issue or quota
      if (error.message && error.message.includes("403")) {
        throw new Error("Acesso negado. Verifique as permissões da sua chave API e se a API está ativada.");
      }
      
      throw error;
    }
  }
  
  throw new Error("Falha desconhecida na geração da imagem.");
};

export const enhanceImagePrompt = async (prompt: string): Promise<string> => {
  // @ts-ignore
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chave API não encontrada. Por favor, selecione um projeto.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `Você é um especialista em engenharia de prompt para geração de imagens por IA (Midjourney, DALL-E, Imagen).
Sua tarefa é pegar o prompt do usuário e melhorá-lo para que fique 100% organizado, detalhado e otimizado para gerar a melhor imagem possível.
Não adicione conversas, apenas retorne o prompt melhorado.
Estruture o prompt com: Assunto principal, Detalhes do ambiente/fundo, Estilo artístico, Iluminação, Cores e Qualidade/Resolução.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Melhore este prompt para geração de imagem: "${prompt}"`,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || prompt;
  } catch (error) {
    console.error("Error enhancing image prompt:", error);
    throw new Error("Falha ao melhorar o prompt da imagem.");
  }
};

export const generateVideoPrompt = async (imageUrl: string): Promise<string> => {
  // @ts-ignore
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chave API não encontrada. Por favor, selecione um projeto.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Extract base64 data and mimeType from data URL
  const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Dados de imagem inválidos");
  }
  const mimeType = matches[1];
  const imageBytes = matches[2];

  const systemInstruction = `Você é um diretor de arte e especialista em prompts para geração de vídeos por IA (Sora, Veo, Runway).
Sua tarefa é analisar a imagem fornecida e criar um prompt de vídeo profissional de 8 segundos que dê vida a essa imagem.
O prompt deve descrever o movimento da câmera, a animação dos elementos na cena, a evolução da iluminação e a atmosfera geral.
Não adicione conversas ou explicações, apenas retorne o prompt de vídeo em português.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBytes,
              mimeType: mimeType,
            },
          },
          {
            text: "Crie um prompt de vídeo profissional de 8 segundos baseado nesta imagem.",
          },
        ],
      },
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "Um vídeo cinematográfico com movimento de câmera suave e iluminação dinâmica.";
  } catch (error) {
    console.error("Error generating video prompt:", error);
    throw new Error("Falha ao gerar o prompt do vídeo.");
  }
};

export const generateVideo = async (
  imageUrl: string,
  prompt: string,
  aspectRatio: AspectRatio
): Promise<string> => {
  // @ts-ignore
  const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chave API não encontrada. Por favor, selecione um projeto.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Extract base64 data and mimeType from data URL
  const matches = imageUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Dados de imagem inválidos");
  }
  const mimeType = matches[1];
  const imageBytes = matches[2];

  // Map AspectRatio to supported Veo ratios (16:9 or 9:16)
  let veoAspectRatio: '16:9' | '9:16' = '16:9';
  if (aspectRatio === '9:16' || aspectRatio === '3:4') {
    veoAspectRatio = '9:16';
  } else {
    veoAspectRatio = '16:9';
  }

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
        aspectRatio: veoAspectRatio,
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    if (operation.error) {
        throw new Error(`Falha na geração do vídeo: ${operation.error.message}`);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("Nenhuma URI de vídeo retornada");
    }

    const videoResponse = await fetch(videoUri, {
        method: 'GET',
        headers: {
            'x-goog-api-key': apiKey,
        },
    });

    if (!videoResponse.ok) {
        throw new Error(`Falha ao buscar vídeo: ${videoResponse.statusText}`);
    }

    const videoBlob = await videoResponse.blob();
    return URL.createObjectURL(videoBlob);

  } catch (error: any) {
    console.error("Gemini Video API Error:", error);
    throw error;
  }
};