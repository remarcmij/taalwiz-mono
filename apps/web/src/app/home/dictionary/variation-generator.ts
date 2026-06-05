export interface VariationGenerator {
  getWordVariations(word: string): string[];
}

export class IdentityVariationGenerator implements VariationGenerator {
  getWordVariations(word: string): string[] {
    return [word];
  }
}
