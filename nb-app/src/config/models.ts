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

export const isGptImage2Model = (modelName?: string): boolean =>
  (modelName || DEFAULT_IMAGE_MODEL) === GPT_IMAGE_2_MODEL;

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

export const getGptImage2Size = (
  resolution: ResolutionOption,
  aspectRatio: string,
): string => {
  if (aspectRatio === 'Auto') {
    return 'auto';
  }

  const [ratioWidth, ratioHeight] = aspectRatio.split(':').map((value) => Number(value));
  if (!ratioWidth || !ratioHeight) {
    return 'auto';
  }

  const edgeLimit = resolution === '1K'
    ? 1024 / Math.min(ratioWidth, ratioHeight)
    : (resolution === '2K' ? 2048 : GPT_IMAGE_2_MAX_EDGE) / Math.max(ratioWidth, ratioHeight);
  const maxScale = Math.floor(edgeLimit);

  for (let scale = maxScale; scale > 0; scale -= 1) {
    const width = ratioWidth * scale;
    const height = ratioHeight * scale;
    const longEdge = Math.max(width, height);
    const shortEdge = Math.min(width, height);
    const pixels = width * height;

    if (width % 16 !== 0 || height % 16 !== 0) {
      continue;
    }
    if (longEdge > GPT_IMAGE_2_MAX_EDGE || longEdge / shortEdge > 3) {
      continue;
    }
    if (pixels < GPT_IMAGE_2_MIN_PIXELS || pixels > GPT_IMAGE_2_MAX_PIXELS) {
      continue;
    }

    return `${width}x${height}`;
  }

  return 'auto';
};
