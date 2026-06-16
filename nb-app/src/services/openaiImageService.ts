import OpenAI from 'openai';
import type { Content, Part as SDKPart } from '@google/genai';
import type { AppSettings, Part } from '../types';
import { DEFAULT_IMAGE_MODEL, getGptImage2Size } from '../config/models';

type OpenAIImageSettings = AppSettings & {
  displayModelName?: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

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

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const unwrapImageResponse = (response: unknown): unknown => {
  const parsed = parseMaybeJson(response);
  if (!isRecord(parsed)) return parsed;

  for (const key of ['body', 'response', 'result', 'raw']) {
    const nested = parsed[key];
    const nestedParsed = parseMaybeJson(nested);
    if (nestedParsed !== nested || (isRecord(nestedParsed) && Array.isArray(nestedParsed.data))) {
      return unwrapImageResponse(nestedParsed);
    }
  }

  return parsed;
};

const getImageItems = (response: unknown): unknown[] => {
  const unwrapped = unwrapImageResponse(response);

  if (Array.isArray(unwrapped)) return unwrapped;
  if (!isRecord(unwrapped)) return [];

  const data = parseMaybeJson(unwrapped.data);
  if (Array.isArray(data)) return data;

  const images = parseMaybeJson(unwrapped.images);
  if (Array.isArray(images)) return images;

  return [];
};

const normalizeImageBase64 = (value: unknown): { mimeType: string; data: string } | null => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dataUrlMatch = trimmed.match(/^data:([^;,]+);base64,(.*)$/s);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1] || 'image/png',
      data: dataUrlMatch[2].replace(/\s/g, ''),
    };
  }

  return {
    mimeType: 'image/png',
    data: trimmed.replace(/\s/g, ''),
  };
};

const describeUnexpectedImageResponse = (response: unknown): string => {
  const unwrapped = unwrapImageResponse(response);

  if (typeof unwrapped === 'string') {
    const trimmed = unwrapped.trim();
    if (!trimmed) return '响应为空字符串';
    if (trimmed.startsWith('<')) {
      return `响应看起来是 HTML：${trimmed.slice(0, 120)}`;
    }
    return `响应是字符串：${trimmed.slice(0, 120)}`;
  }

  if (isRecord(unwrapped)) {
    const keys = Object.keys(unwrapped).join(', ');
    return `响应里没有图片字段，可见键：${keys || '无'}`;
  }

  if (Array.isArray(unwrapped)) {
    return `响应是数组，但没有可用图片项，长度：${unwrapped.length}`;
  }

  return `响应类型异常：${typeof unwrapped}`;
};

const parseImageResponse = async (
  response: Awaited<ReturnType<OpenAI['images']['generate']>> | unknown,
  signal?: AbortSignal,
): Promise<Part[]> => {
  const parts: Part[] = [];

  for (const item of getImageItems(response)) {
    if (!isRecord(item)) continue;

    const base64Image = normalizeImageBase64(item.b64_json ?? item.base64 ?? item.image_base64);
    if (base64Image) {
      parts.push({
        inlineData: {
          mimeType: base64Image.mimeType,
          data: base64Image.data,
        },
        downloadFilenamePrefix: 'gpt-image',
      });
    } else if (typeof item.url === 'string' && item.url) {
      parts.push({
        ...(await imageUrlToPart(item.url, signal)),
        downloadFilenamePrefix: 'gpt-image',
      });
    }
  }

  if (parts.length === 0) {
    throw new Error(`OpenAI 图片接口没有返回可用图片。${describeUnexpectedImageResponse(response)}`);
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
        response_format: 'b64_json',
        n: 1,
      }, { signal })
    : await client.images.generate({
        model,
        prompt: normalizedPrompt,
        size,
        quality: settings.gptImageQuality,
        response_format: 'b64_json',
        n: 1,
      }, { signal });

  return {
    userContent: currentUserContent,
    modelParts: await parseImageResponse(response, signal),
  };
};
