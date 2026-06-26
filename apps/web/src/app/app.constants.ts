import { TARGET_LANG } from '@repo/shared';
import { deployment } from '../environments/deployment';
import { IndonesianVariationGenerator } from './home/dictionary/indonesian-variation-generator';
import type { VariationGenerator } from './home/dictionary/variation-generator';

export const langConfig = {
  targetLang: TARGET_LANG,
  // Per-instance, baked in at build time (see scripts/generate-deployment.mjs):
  // 'nl' for the Teeuw deployment, 'en' for the Stevens deployment.
  nativeLang: deployment.nativeLang,
  variationGenerator: new IndonesianVariationGenerator() as VariationGenerator,
};
