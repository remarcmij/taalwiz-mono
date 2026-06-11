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

// --------------------------------------------------------------------------
// Optional dev trace. When the localStorage flag `taalwiz.trace-variations` is
// set (e.g. `localStorage.setItem('taalwiz.trace-variations', '1')` in the
// browser console), getWordVariations() prints the recursive stripping tree to
// the console — the same shape as the worked trace in SEARCH.md. Pure debugging
// aid: it builds a parallel TraceNode tree alongside the real Set recursion and
// never affects the returned variations. Off (and zero-cost) by default.
// --------------------------------------------------------------------------

interface TraceNode {
  word: string;
  /** Label of the rule that produced this node from its parent; null for the root. */
  rule: string | null;
  /** Insertion sequence number in the result Set, or null when this is a duplicate. */
  seq: number | null;
  /** True when `word` was already in the Set on this visit (the subtree is not expanded). */
  dup: boolean;
  children: TraceNode[];
}

function isTraceEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem('taalwiz.trace-variations');
  } catch {
    return false;
  }
}

/** Render a TraceNode tree as the box-drawing trace shown in SEARCH.md. */
function renderTrace(root: TraceNode): string {
  const marker = (n: TraceNode) => (n.dup ? '(dup)' : `#${n.seq}`);
  const lines: string[] = [`${root.word}  ${marker(root)}`];

  const walk = (children: TraceNode[], prefix: string) => {
    children.forEach((child, i) => {
      const last = i === children.length - 1;
      lines.push(`${prefix}${last ? '└─ ' : '├─ '}${child.rule} ► ${child.word}  ${marker(child)}`);
      walk(child.children, prefix + (last ? '   ' : '│  '));
    });
  };

  walk(root.children, '');
  return lines.join('\n');
}

export class IndonesianVariationGenerator implements VariationGenerator {
  getWordVariations(word: string): string[] {
    const variations: Set<string> = new Set();

    if (isTraceEnabled()) {
      // The recursion attaches each visited word to its trace parent; a throwaway
      // holder collects the real root as its single child.
      const holder: TraceNode = { word: '', rule: null, seq: null, dup: false, children: [] };
      this.getVariations(word, variations, false, holder);
      const result = [...variations];
      const root = holder.children[0];
      if (root) {
        console.log(`${renderTrace(root)}\n→ [${result.join(', ')}]`);
      }
      return result;
    }

    this.getVariations(word, variations, false);
    return [...variations];
  }

  // `traceParent` drives the optional dev trace: `undefined` means tracing is
  // off (the production path); a node (or the root holder) means attach this
  // word under it. Recursing into an already-seen word passes `undefined` to its
  // children, so a duplicate is shown as a leaf and its subtree is not re-walked.
  private getVariations(
    word: string,
    variations: Set<string>,
    mePrefixed: boolean,
    traceParent?: TraceNode,
    ruleLabel?: string,
  ) {
    const isNew = !variations.has(word);
    variations.add(word);

    let childTrace: TraceNode | undefined;
    if (traceParent) {
      const node: TraceNode = {
        word,
        rule: ruleLabel ?? null,
        seq: isNew ? variations.size : null,
        dup: !isNew,
        children: [],
      };
      traceParent.children.push(node);
      childTrace = isNew ? node : undefined; // a dup is a leaf; do not re-trace its subtree
    }

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
            this.getVariations(match[1], variations, mePrefixed, childTrace, `strip ${rule.label}`);
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
            this.getVariations(meWord, variations, true, childTrace, rule.label);
          }
          if (rule.alsoBare) {
            this.getVariations(base, variations, true, childTrace, `${rule.label} (bare root)`);
          }
          break;
        }
        case 'nasal': {
          for (const cand of nasalCandidates(word, rule.stem)) {
            this.getVariations(cand.remainder, variations, mePrefixed, childTrace, `nasal ${cand.surface}`);
          }
          break;
        }
      }
    }
  }

}
