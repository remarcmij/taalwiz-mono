import { nasalCandidates, prefixWithMeN } from './indonesian-nasal-rules';
import type { VariationGenerator } from './variation-generator';

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

// --------------------------------------------------------------------------
// The generator is a depth-first search: for each form, add it to the result
// set, then apply every matching rule and recurse into the form(s) each rule
// produces. The rules come in three SHAPES (the discriminated union below).
// They are listed once, in execution order, in RULES; the engine in
// `getVariations` just walks that list. The ORDER is load-bearing — the set's
// insertion order is the dictionary lookup priority, and the synthesis rules
// must emit the active meN- form before the bare root is reached — so the rule
// list is a single ordered pipeline, not three independent unordered tables.
// See SEARCH.md for the priority rationale and learnings/ for the refactor.
// --------------------------------------------------------------------------

/**
 * Shape 1 — SIMPLE STRIP. Peel a fixed affix and recurse into the remainder
 * (regex capture group 1). The `mePrefixed` flag is carried through unchanged.
 */
interface SimpleStrip {
  kind: 'strip';
  label: string;
  pattern: RegExp;
}

/**
 * Shape 2 — SYNTHESIS. Not a strip: reconstruct the active meN- form (FORWARD
 * generation, via prefixWithMeN) so a passive/reduced form resolves to its
 * indexed active form. Runs only when not already inside a synthesised branch
 * (`!mePrefixed`) and recurses with `mePrefixed = true` to prevent re-synthesis.
 * `base` selects what gets the meN- prefix; `alsoBare` additionally recurses
 * into the bare base (the di- rule does, the -kan/-i rule does not).
 */
interface SynthesisRule {
  kind: 'synthesize';
  label: string;
  pattern: RegExp;
  base: 'group1' | 'word';
  alsoBare: boolean;
}

/**
 * Shape 3 — NASAL STRIP. Undo meN-/peN- assimilation via the shared allomorphy
 * table (indonesian-nasal-rules.ts), which yields 0..n candidate remainders
 * (bare, consonant-restored, and bare-nasal-root). `mePrefixed` is carried through.
 */
interface NasalStrip {
  kind: 'nasal';
  label: string;
  stem: string;
}

type Rule = SimpleStrip | SynthesisRule | NasalStrip;

// Outermost clitics and pronoun pro-/enclitics, peeled first.
const CLITIC_STRIPS: SimpleStrip[] = [
  { kind: 'strip', label: '-nya', pattern: /^(.{2,})nya$/ },
  { kind: 'strip', label: '-ku/-kau/-mu', pattern: /^(.{2,})(?:ku|kau|mu)$/ },
  { kind: 'strip', label: 'mu-', pattern: /^mu(.{2,})$/ },
  { kind: 'strip', label: 'ku-/kau-', pattern: /^(?:ku|kau)(.{2,})$/ },
];

// Active-form reconstruction. These run before the derivational strips so the
// synthesised active form is emitted ahead of the bare root (lookup priority).
const SYNTHESIS_RULES: SynthesisRule[] = [
  // di- passive -> active meN- form, then the bare root.
  { kind: 'synthesize', label: 'di- -> meN-', pattern: /^di(.{2,})$/, base: 'group1', alsoBare: true },
  // A reduced -kan/-i form (not already a meN- form) -> its active meN- form.
  // The bare root is still reached later by the -kan/-i strips below.
  { kind: 'synthesize', label: '-kan/-i -> meN-', pattern: /^[^m].{2,}(?:kan|i)$/, base: 'word', alsoBare: false },
];

// Derivational/inflectional affixes and circumfixes.
const AFFIX_STRIPS: SimpleStrip[] = [
  { kind: 'strip', label: '-kah/-lah/-tah/-pun', pattern: /^(.{2,})(?:[klt]ah|pun)$/ },
  { kind: 'strip', label: 'ter-', pattern: /^ter(.{2,})$/ },
  { kind: 'strip', label: 'ber-', pattern: /^ber(.{2,})$/ },
  { kind: 'strip', label: 'per-', pattern: /^per(.{2,})$/ },
  { kind: 'strip', label: 'se-', pattern: /^se(.{2,})$/ },
  { kind: 'strip', label: '-kan', pattern: /^(.{2,})kan$/ },
  { kind: 'strip', label: '-i', pattern: /^(.{2,})i$/ },
  { kind: 'strip', label: '-an', pattern: /^(.{3,})an$/ },
  { kind: 'strip', label: 'ke-', pattern: /^ke(.{2,})$/ },
  { kind: 'strip', label: 'ke-...-an', pattern: /^ke(.{2,})an$/ },
  { kind: 'strip', label: 'per-...-an', pattern: /^per(.{2,})an$/ },
  { kind: 'strip', label: 'pe-...-an', pattern: /^pe(.{2,})an$/ },
];

// meN-/peN- active/agentive prefixes with consonant allomorphy (shared table).
const NASAL_STRIPS: NasalStrip[] = [
  { kind: 'nasal', label: 'meN-', stem: 'me' },
  { kind: 'nasal', label: 'peN-', stem: 'pe' },
];

const REDUPLICATION: SimpleStrip[] = [
  { kind: 'strip', label: 'reduplication', pattern: /^(.{2,})-.{2,}$/ },
];

// The single ordered pipeline the engine walks. Order == lookup priority.
const RULES: Rule[] = [
  ...CLITIC_STRIPS,
  ...SYNTHESIS_RULES,
  ...AFFIX_STRIPS,
  ...NASAL_STRIPS,
  ...REDUPLICATION,
];

export class IndonesianVariationGenerator implements VariationGenerator {
  getWordVariations(word: string): string[] {
    const variations: Set<string> = new Set();
    this.getVariations(word, variations, false);
    return [...variations];
  }

  private getVariations(word: string, variations: Set<string>, mePrefixed: boolean) {
    variations.add(word);

    if (WordExemptions.indexOf(word) !== -1) {
      return;
    }

    // Walk the ordered pipeline. Each matching rule recurses immediately
    // (depth-first), so emission order follows rule order; the Set dedups.
    for (const rule of RULES) {
      switch (rule.kind) {
        case 'strip': {
          const match = word.match(rule.pattern);
          if (match) {
            this.getVariations(match[1], variations, mePrefixed);
          }
          break;
        }
        case 'synthesize': {
          if (mePrefixed) break; // never synthesise inside an already-synthesised branch
          const match = word.match(rule.pattern);
          if (!match) break;
          const base = rule.base === 'group1' ? match[1] : word;
          const meWord = prefixWithMeN(base);
          if (meWord !== base) {
            this.getVariations(meWord, variations, true);
          }
          if (rule.alsoBare) {
            this.getVariations(base, variations, true);
          }
          break;
        }
        case 'nasal': {
          for (const cand of nasalCandidates(word, rule.stem)) {
            this.getVariations(cand.remainder, variations, mePrefixed);
          }
          break;
        }
      }
    }
  }

}
