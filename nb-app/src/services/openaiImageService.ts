import OpenAI from 'openai';
import type { Content, Part as SDKPart } from '@google/genai';
import type { AppSettings, Part } from '../types';
import { DEFAULT_IMAGE_MODEL, getGptImage2Size } from '../config/models';

type OpenAIImageSettings = AppSettings & {
  displayModelName?: string;
};

const constructUserContent = (
  prompt: string,
  images: { base64Data: string; mimeType: string }[],
): Content => {
  const userParts: SDKPart[] = images.map((img) => ({
    inlineData: {
      mimeType: img.mimeType,
      data: img.base64Data,
    },
  }));

  if (prompt.trim()) {
    userParts.push({ text: prompt });
  }

  return {
    role: 'user',
    parts: userParts,
  };
};

const createOpenAIClient = (apiKey: string, endpoint?: string) => {
  const baseUrl = (endpoint || 'https://api.aigod.one').replace(/\/+$/, '');
  return new OpenAI({
    apiKey,
    baseURL: `${baseUrl}/v1`,
    dangerouslyAllowBrowser: true,
  });
};

const getFileExtension = (mimeType: string) => {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
};

const base64ToFile = (base64Data: string, mimeType: string, index: number) => {
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], `reference-${index + 1}.${getFileExtension(mimeType)}`, { type: mimeType });
};

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    resolve(result.includes(',') ? result.split(',')[1] : result);
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

const imageUrlToPart = async (url: string, signal?: AbortSignal): Promise<Part> => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`图片下载失败 (${response.status})`);
  }

  const blob = await response.blob();
  return {
    inlineData: {
      mimeType: blob.type || 'image/png',
      data: await blobToBase64(blob),
    },
  };
};

const parseImageResponse = async (
  response: Awaited<ReturnType<OpenAI['images']['generate']>>,
  signal?: AbortSignal,
): Promise<Part[]> => {
  const parts: Part[] = [];

  for (const item of response.data || []) {
    if (item.b64_json) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: item.b64_json,
        },
        downloadFilenamePrefix: 'gpt-image',
      });
    } else if (item.url) {
      parts.push({
        ...(await imageUrlToPart(item.url, signal)),
        downloadFilenamePrefix: 'gpt-image',
      });
    }
  }

  if (parts.length === 0) {
    throw new Error('OpenAI 图片接口没有返回图片。');
  }

  return parts;
};

export const generateOpenAIImageContent = async (
  apiKey: string,
  prompt: string,
  images: { base64Data: string; mimeType: string }[],
  settings: OpenAIImageSettings,
  signal?: AbortSignal,
) => {
  const client = createOpenAIClient(apiKey, settings.customEndpoint);
  const currentUserContent = constructUserContent(prompt, images);
  const size = getGptImage2Size(settings.resolution, settings.aspectRatio);
  const model = settings.modelName || DEFAULT_IMAGE_MODEL;
  const normalizedPrompt = prompt.trim() || 'Generate an image';

  const response = images.length > 0
    ? await client.images.edit({
        model,
        image: images.map((image, index) => base64ToFile(image.base64Data, image.mimeType, index)),
        prompt: normalizedPrompt,
        size,
        quality: settings.gptImageQuality,
        n: 1,
      }, { signal })
    : await client.images.generate({
        model,
        prompt: normalizedPrompt,
        size,
        quality: settings.gptImageQuality,
        n: 1,
      }, { signal });

  return {
    userContent: currentUserContent,
    modelParts: await parseImageResponse(response, signal),
  };
};
