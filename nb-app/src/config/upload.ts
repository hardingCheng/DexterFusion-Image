import { isGptImage2Model } from './models';

export const MAX_REFERENCE_IMAGES = 9;
export const MAX_GPT_IMAGE_2_REFERENCE_IMAGES = 6;
export const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_REFERENCE_IMAGE_SIZE_LABEL = '10MB';

export const getMaxReferenceImages = (modelName?: string) =>
  isGptImage2Model(modelName) ? MAX_GPT_IMAGE_2_REFERENCE_IMAGES : MAX_REFERENCE_IMAGES;
