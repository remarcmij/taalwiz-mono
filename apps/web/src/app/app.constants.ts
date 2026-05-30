import { NATIVE_LANG, TARGET_LANG } from '@repo/shared';
import { IndonesianStemmer } from './home/dictionary/indonesian-stemmer';
import type { Stemmer } from './home/dictionary/stemmer';

export const langConfig = {
  targetLang: TARGET_LANG,
  nativeLang: NATIVE_LANG,
  stemmer: new IndonesianStemmer() as Stemmer,
};
