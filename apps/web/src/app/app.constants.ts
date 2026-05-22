import { IndonesianStemmer } from './home/dictionary/indonesian-stemmer';
import type { Stemmer } from './home/dictionary/stemmer';

export const langConfig = {
  targetLang: 'id',
  nativeLang: 'nl',
  stemmer: new IndonesianStemmer() as Stemmer,
};
