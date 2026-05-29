import type { Stemmer } from './stemmer';

const WordExemptions: string[] = [
  'aku',
  'ilmu',
  'kamu',
  'tamu',
  'temu',
  'dia',
  'bukan',
  'ini',
  'nyanyi',
  'ngaji',
];

export class IndonesianStemmer implements Stemmer {
  getWordVariations(word: string): string[] {
    const variations: Set<string> = new Set();
    this.getVariations(word, variations, false);
    return [...variations];
  }

  private getVariations(word: string, variations: Set<string>, mePrefixed: boolean) {
    let meWord: string;

    variations.add(word);

    if (WordExemptions.indexOf(word) !== -1) {
      return;
    }

    // strip -nya suffix (possessive/definiteness marker)
    let match = word.match(/^(.{2,})nya$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip -ku, -kau, -mu suffixes (personal clitics)
    match = word.match(/^(.{2,})(?:ku|kau|mu)$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip mu- prefix
    match = word.match(/^mu(.{2,})$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip ku- and kau- prefixes
    match = word.match(/^(?:ku|kau)(.{2,})$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip di- prefix and generate me- variants
    match = word.match(/^di(.{2,})$/);
    if (match && !mePrefixed) {
      const matchWord = match[1];
      meWord = this.prefixWithMeng(matchWord);
      if (meWord !== matchWord) {
        this.getVariations(meWord, variations, true);
      }
      // also add the bare root
      this.getVariations(matchWord, variations, true);
    }

    // strip -kah, -lah, -tah, -pun particles
    match = word.match(/^(.{2,})(?:[klt]ah|pun)$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip ter- prefix
    match = word.match(/^ter(.{2,})$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip ber- prefix
    match = word.match(/^ber(.{2,})$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip per- prefix (e.g. memperbaik → perbaik → baik)
    match = word.match(/^per(.{2,})$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip se- prefix
    match = word.match(/^se(.{2,})$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip -kan suffix (causative/benefactive)
    match = word.match(/^(.{2,})kan$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip -i suffix (locative/repetitive)
    match = word.match(/^(.{2,})i$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip -an suffix (nominalizing)
    match = word.match(/^(.{3,})an$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip ke- prefix
    match = word.match(/^ke(.{2,})$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip ke-...-an circumfix
    match = word.match(/^ke(.{2,})an$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip per-...-an circumfix
    match = word.match(/^per(.{2,})an$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip pe-...-an circumfix
    match = word.match(/^pe(.{2,})an$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }

    // strip meN- prefix (me-, meng-, mem-, men-, meny-)
    const meNVariations = this.stripMeN(word);
    if (meNVariations) {
      for (const stripped of meNVariations) {
        this.getVariations(stripped, variations, mePrefixed);
      }
    }

    // strip peN- prefix (pe-, peng-, pem-, pen-, peny-)
    const peNVariations = this.stripPeN(word);
    if (peNVariations) {
      for (const stripped of peNVariations) {
        this.getVariations(stripped, variations, mePrefixed);
      }
    }

    // if word ends with -kan or -i and doesn't start with m, add meng prefix
    match = word.match(/^[^m].{2,}(?:kan|i)$/);
    if (match && !mePrefixed) {
      meWord = this.prefixWithMeng(word);
      if (meWord !== word) {
        this.getVariations(meWord, variations, true);
      }
    }

    // strip reduplication (e.g., anak-anak -> anak)
    match = word.match(/^(.{2,})-.{2,}$/);
    if (match) {
      this.getVariations(match[1], variations, mePrefixed);
    }
  }

  private stripMeN(word: string): string[] | null {
    const results: string[] = [];

    if (word.startsWith('meng')) {
      const rest = word.substring(4);
      results.push(rest);
      if (rest && !/^[aeiouagh]/.test(rest)) {
        results.push('k' + rest);
      }
      // bare me- + ng-initial root (e.g. menganga → nganga)
      results.push(word.substring(2));
    } else if (word.startsWith('meny')) {
      const rest = word.substring(4);
      results.push(rest);
      results.push('s' + rest);
      // bare me- + ny-initial root (e.g. menyala → nyala)
      results.push(word.substring(2));
    } else if (word.startsWith('mem')) {
      const rest = word.substring(3);
      results.push(rest);
      if (rest && !/^[bf]/.test(rest)) {
        results.push('p' + rest);
      }
      // bare me- + m-initial root (e.g. memegakan → megakan → mega)
      results.push(word.substring(2));
    } else if (word.startsWith('men')) {
      const rest = word.substring(3);
      results.push(rest);
      if (rest && !/^[dcjz]/.test(rest) && !rest.startsWith('sy')) {
        results.push('t' + rest);
      }
      // bare me- + n-initial root (e.g. menilai → nilai)
      results.push(word.substring(2));
    } else if (word.startsWith('me')) {
      results.push(word.substring(2));
    }

    return results.length > 0 ? results : null;
  }

  private stripPeN(word: string): string[] | null {
    const results: string[] = [];

    if (word.startsWith('peng')) {
      const rest = word.substring(4);
      results.push(rest);
      if (rest && !/^[aeiouagh]/.test(rest)) {
        results.push('k' + rest);
      }
      // bare pe- + ng-initial root
      results.push(word.substring(2));
    } else if (word.startsWith('peny')) {
      const rest = word.substring(4);
      results.push(rest);
      results.push('s' + rest);
      // bare pe- + ny-initial root
      results.push(word.substring(2));
    } else if (word.startsWith('pem')) {
      const rest = word.substring(3);
      results.push(rest);
      if (rest && !/^[bf]/.test(rest)) {
        results.push('p' + rest);
      }
      // bare pe- + m-initial root (e.g. pemalu → malu)
      results.push(word.substring(2));
    } else if (word.startsWith('pen')) {
      const rest = word.substring(3);
      results.push(rest);
      if (rest && !/^[dcjz]/.test(rest) && !rest.startsWith('sy')) {
        results.push('t' + rest);
      }
      // bare pe- + n-initial root (e.g. penilai → nilai)
      results.push(word.substring(2));
    } else if (word.startsWith('pe')) {
      results.push(word.substring(2));
    }

    return results.length > 0 ? results : null;
  }

  private prefixWithMeng(word: string): string {
    if (word.match(/^[aeiou]/)) {
      return 'meng' + word;
    } else if (word.match(/^[bf]/)) {
      return 'mem' + word;
    } else if (word.match(/^p/)) {
      if (!word.match(/^(?:per|pelajar)/)) {
        return 'mem' + word.substring(1);
      }
      return 'mem' + word;
    } else if (word.match(/^(?:d|t|c|j|sy|z)/)) {
      if (word.match(/^t/)) {
        return 'men' + word.substring(1);
      }
      return 'men' + word;
    } else if (word.match(/^s/)) {
      return 'meny' + word.substring(1);
    } else if (word.match(/^(?:g|h|kh|k)/)) {
      if (word.match(/^k[^h]/)) {
        return 'meng' + word.substring(1);
      }
      return 'meng' + word;
    } else if (word.match(/^(?:l|r|m|n|ny|ng|w|y)/)) {
      return 'me' + word;
    }
    return word;
  }
}
