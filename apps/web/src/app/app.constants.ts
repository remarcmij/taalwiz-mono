import { NATIVE_LANG, TARGET_LANG } from '@repo/shared';
import { IndonesianVariationGenerator } from './home/dictionary/indonesian-variation-generator';
import type { VariationGenerator } from './home/dictionary/variation-generator';

export const langConfig = {
  targetLang: TARGET_LANG,
  nativeLang: NATIVE_LANG,
  variationGenerator: new IndonesianVariationGenerator() as VariationGenerator,
};
