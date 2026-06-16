export const DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image-preview';
export const GPT_IMAGE_2_MODEL = 'gpt-image-2';

export const IMAGE_MODEL_GROUPS = [
  {
    label: 'Gemini 系列',
    models: [
      { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro' },
      { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash' },
      // { value: 'gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash (Preview)' },
      { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash' },
    ],
  },
  {
    label: 'GPT 系列',
    models: [
      { value: GPT_IMAGE_2_MODEL, label: 'GPT Image 2' },
    ],
  },
] as const;

export const AVAILABLE_IMAGE_MODELS = IMAGE_MODEL_GROUPS.flatMap((group) => group.models);

export const RESOLUTION_SUPPORTED_IMAGE_MODELS = new Set<string>([
  'gemini-3-pro-image-preview',
  GPT_IMAGE_2_MODEL,
  'gemini-3.1-flash-image-preview',
]);

export const supportsImageResolution = (modelName?: string): boolean =>
  RESOLUTION_SUPPORTED_IMAGE_MODELS.has(modelName || DEFAULT_IMAGE_MODEL);

export const LEGACY_ASPECT_RATIO_OPTIONS = ['Auto', '1:1', '3:4', '4:3', '9:16', '16:9', '21:9'] as const;

export const FULL_ASPECT_RATIO_OPTIONS = [
  'Auto',
  '1:1',
  '3:4',
  '4:3',
  '16:9',
  '9:16',
  '2:3',
  '3:2',
  '21:9',
  '4:5',
] as const;

export type AspectRatioOption = (typeof FULL_ASPECT_RATIO_OPTIONS)[number];
export type ResolutionOption = '1K' | '2K' | '4K';

export const FULL_ASPECT_RATIO_IMAGE_MODELS = new Set<string>([
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
]);

const GPT_IMAGE_2_MIN_PIXELS = 655_360;
const GPT_IMAGE_2_MAX_PIXELS = 8_294_400;
const GPT_IMAGE_2_MAX_EDGE = 3840;
const GPT_IMAGE_2_MAX_ASPECT_RATIO = 3;
export const GPT_IMAGE_2_EXPERIMENTAL_PIXELS = 2560 * 1440;
const GPT_IMAGE_2_TARGET_LONG_EDGE: Record<ResolutionOption, number> = {
  '1K': 1024,
  '2K': 2048,
  '4K': GPT_IMAGE_2_MAX_EDGE,
};

export const isGptImage2Model = (modelName?: string): boolean =>
  (modelName || DEFAULT_IMAGE_MODEL) === GPT_IMAGE_2_MODEL;

export const isGeminiImageModel = (modelName?: string): boolean =>
  (modelName || DEFAULT_IMAGE_MODEL).startsWith('gemini-');

export const getAspectRatioOptions = (
  modelName?: string,
  resolution: ResolutionOption = '1K',
): readonly AspectRatioOption[] => {
  if (isGptImage2Model(modelName)) {
    return FULL_ASPECT_RATIO_OPTIONS;
  }
  return FULL_ASPECT_RATIO_IMAGE_MODELS.has(modelName || DEFAULT_IMAGE_MODEL)
    ? FULL_ASPECT_RATIO_OPTIONS
    : LEGACY_ASPECT_RATIO_OPTIONS;
};

export const supportsAspectRatio = (
  modelName: string | undefined,
  aspectRatio: string,
  resolution: ResolutionOption = '1K',
): boolean => getAspectRatioOptions(modelName, resolution).includes(aspectRatio as AspectRatioOption);

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }

  return x || 1;
};

const parseAspectRatio = (aspectRatio: string): [number, number] | null => {
  const [rawWidth, rawHeight] = aspectRatio.split(':').map((value) => Number(value));
  if (!Number.isInteger(rawWidth) || !Number.isInteger(rawHeight) || rawWidth <= 0 || rawHeight <= 0) {
    return null;
  }

  const divisor = gcd(rawWidth, rawHeight);
  return [rawWidth / divisor, rawHeight / divisor];
};

const parseSize = (size: string): [number, number] | null => {
  const [rawWidth, rawHeight] = size.split('x').map((value) => Number(value));
  if (!Number.isInteger(rawWidth) || !Number.isInteger(rawHeight) || rawWidth <= 0 || rawHeight <= 0) {
    return null;
  }

  return [rawWidth, rawHeight];
};

export const isValidGptImage2Dimensions = (width: number, height: number): boolean => {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return false;
  }

  const longEdge = Math.max(width, height);
  const shortEdge = Math.min(width, height);
  const pixels = width * height;

  return width % 16 === 0
    && height % 16 === 0
    && longEdge <= GPT_IMAGE_2_MAX_EDGE
    && longEdge / shortEdge <= GPT_IMAGE_2_MAX_ASPECT_RATIO
    && pixels >= GPT_IMAGE_2_MIN_PIXELS
    && pixels <= GPT_IMAGE_2_MAX_PIXELS;
};

export const isExperimentalGptImage2Size = (size: string): boolean => {
  const dimensions = parseSize(size);
  if (!dimensions) {
    return false;
  }

  const [width, height] = dimensions;
  return width * height > GPT_IMAGE_2_EXPERIMENTAL_PIXELS;
};

export const getGptImage2Size = (
  resolution: ResolutionOption,
  aspectRatio: string,
): string => {
  if (aspectRatio === 'Auto') {
    return 'auto';
  }

  const ratio = parseAspectRatio(aspectRatio);
  if (!ratio) {
    return 'auto';
  }

  const [ratioWidth, ratioHeight] = ratio;
  const targetLongEdge = GPT_IMAGE_2_TARGET_LONG_EDGE[resolution];
  const maxScale = Math.floor(GPT_IMAGE_2_MAX_EDGE / Math.max(ratioWidth, ratioHeight));
  const candidates: Array<{ width: number; height: number; longEdge: number; scale: number }> = [];

  for (let scale = 1; scale <= maxScale; scale += 1) {
    const width = ratioWidth * scale;
    const height = ratioHeight * scale;

    if (isValidGptImage2Dimensions(width, height)) {
      candidates.push({
        width,
        height,
        longEdge: Math.max(width, height),
        scale,
      });
    }
  }

  if (candidates.length === 0) {
    return 'auto';
  }

  const withinTarget = candidates.filter((candidate) => candidate.longEdge <= targetLongEdge);
  const selected = withinTarget.length > 0
    ? withinTarget.reduce((best, candidate) => (candidate.scale > best.scale ? candidate : best))
    : candidates.reduce((best, candidate) => (candidate.scale < best.scale ? candidate : best));

  return `${selected.width}x${selected.height}`;
};
