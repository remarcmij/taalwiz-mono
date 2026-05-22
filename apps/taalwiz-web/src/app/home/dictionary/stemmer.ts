export interface Stemmer {
  getWordVariations(word: string): string[];
}

export class IdentityStemmer implements Stemmer {
  getWordVariations(word: string): string[] {
    return [word];
  }
}
