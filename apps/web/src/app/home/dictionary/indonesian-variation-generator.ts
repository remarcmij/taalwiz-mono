import { nasalCandidates, prefixWithMeN } from './indonesian-nasal-rules';
import { BE_ALLOMORPH_STRIP } from './indonesian-ber-rules';
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
  {
    kind: 'synthesize',
    label: 'di- -> meN-',
    pattern: /^di(.{2,})$/,
    base: 'group1',
    alsoBare: true,
  },
  // A reduced -kan/-i form (not already a meN- form) -> its active meN- form.
  // The bare root is still reached later by the -kan/-i strips below.
  {
    kind: 'synthesize',
    label: '-kan/-i -> meN-',
    pattern: /^[^m].{2,}(?:kan|i)$/,
    base: 'word',
    alsoBare: false,
  },
];

// Derivational/inflectional affixes and circumfixes.
const AFFIX_STRIPS: SimpleStrip[] = [
  { kind: 'strip', label: '-kah/-lah/-tah/-pun', pattern: /^(.{2,})(?:[klt]ah|pun)$/ },
  { kind: 'strip', label: 'ter-', pattern: /^ter(.{2,})$/ },
  { kind: 'strip', label: 'ber-', pattern: /^ber(.{2,})$/ },
  // be- allomorph of ber- (elided -r before r-initial / -er-first-syllable roots:
  // bekerja -> kerja, beragam -> ragam). Guarded by the shared pattern so it does
  // not over-strip be-initial non-derivations (betapa, begitu); over-generated
  // misses are harmless here since the dictionary validates every candidate.
  { kind: 'strip', label: 'ber- (be-)', pattern: BE_ALLOMORPH_STRIP },
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
// Optional dev trace, driven by the `taalwiz.trace-variations` localStorage flag
// read as a verbosity level (set it in the browser console, e.g.
// `localStorage.setItem('taalwiz.trace-variations', '2')`):
//   0 (or unset/invalid) — no tracing
//   1 — the flat `word -> [...]` variations line only (logged by DictionaryService)
//   2 — also print the recursive stripping tree below — the same shape as the
//       worked trace in SEARCH.md
// The tree is a pure debugging aid: it builds a parallel TraceNode tree alongside
// the real Set recursion and never affects the returned variations. Off (and
// zero-cost) by default.
// --------------------------------------------------------------------------

interface TraceNode {
  word: string;
  /** Label of the rule that produced this node from its parent; null for the root. */
  rule: string | null;
  /**
   * False on a word's first occurrence in the (depth-first) recursion, true on
   * every later repeat. The full recursion is traced — repeats included —
   * because re-walking a repeated word can still create a brand-new form deeper
   * down (e.g. `ikan`, born by re-stripping a repeated `berikan`). renderTrace()
   * then prunes: first-occurrence nodes, plus any repeat on the path to such a
   * birth, are drawn; repeats that introduce nothing new are dropped. So each
   * new word appears once, numbered by its slot in the returned array, at its
   * true point of first creation — and the `#N` labels read straight down.
   */
  dup: boolean;
  children: TraceNode[];
}

/**
 * Read the `taalwiz.trace-variations` localStorage flag as a verbosity level:
 *   0 — no tracing (also the result for an unset or non-numeric value)
 *   1 — log the flat variations array only (DictionaryService.#logVariations)
 *   2 — also print the recursive stripping tree (this module)
 * localStorage holds strings, and '0' is itself a truthy string, so we parse the
 * value rather than test for presence — otherwise setting the flag to '0' would
 * fail to disable the trace. The legacy 'true' value maps to full tracing (2).
 */
export function getTraceLevel(): number {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem('taalwiz.trace-variations');
    if (raw === null) return 0;
    if (raw.toLowerCase() === 'true') return 2;
    const level = Number.parseInt(raw, 10);
    return Number.isFinite(level) && level > 0 ? level : 0;
  } catch {
    return 0;
  }
}

/**
 * Render a TraceNode tree as the box-drawing trace shown in SEARCH.md. Each
 * first-occurrence node is numbered by its position in `order` (the returned
 * variations), so the `#N` labels line up exactly with the final array; `(dup)`
 * marks a repeat of a word already numbered higher up.
 *
 * The raw tree records every recursion, including re-entered (repeated) branches.
 * We prune at render time: a first-occurrence node shows all its children, but a
 * repeated node is kept only when its subtree still contains a NEW word — and
 * then only the birth-bearing children are drawn. This surfaces a word at its
 * true point of first creation (e.g. `ikan`, born by re-stripping a repeated
 * `berikan`) while dropping the redundant re-listing of already-seen forms, so
 * the `#N` numbering reads straight down the tree.
 */
function renderTrace(root: TraceNode, order: string[]): string {
  const index = new Map(order.map((w, i) => [w, i + 1]));
  const marker = (n: TraceNode) => (n.dup ? '(dup)' : `#${index.get(n.word)}`);

  // A subtree is worth drawing if it introduces a first-occurrence (non-dup) node.
  const bearsNew = (n: TraceNode): boolean => !n.dup || n.children.some(bearsNew);
  // A first-occurrence node shows every child; a repeat shows only births.
  const childrenToShow = (n: TraceNode) => (n.dup ? n.children.filter(bearsNew) : n.children);

  const lines: string[] = [`${root.word}  ${marker(root)}`];
  const walk = (children: TraceNode[], prefix: string) => {
    children.forEach((child, i) => {
      const last = i === children.length - 1;
      lines.push(`${prefix}${last ? '└─ ' : '├─ '}${child.rule} ► ${child.word}  ${marker(child)}`);
      walk(childrenToShow(child), prefix + (last ? '   ' : '│  '));
    });
  };

  walk(childrenToShow(root), '');
  return lines.join('\n');
}

// Shortest candidate worth keeping. No Indonesian headword is 0 or 1 letter, so
// a produced form below this can never match a dictionary entry — it is pure
// over-generation leakage (e.g. nasal-stripping `meng` -> ``, or `k`/`ng`). The
// floor is 2, NOT higher: genuine 2-letter roots that carry derivations do exist
// and must stay reachable from their derived/clitic forms — e.g. `am` (mengamkan,
// *amnya*), `es` (menges, *esnya*), `ia` (mengiakan, beria, *ianya*). The
// typed word itself bypasses this guard (it is always candidate 0), so even a
// sub-2-char query still self-hits; only *derived* candidates are floored.
const MIN_CANDIDATE_LENGTH = 2;

export class IndonesianVariationGenerator implements VariationGenerator {
  getWordVariations(word: string): string[] {
    const variations: Set<string> = new Set();

    if (getTraceLevel() >= 2) {
      // The recursion attaches each visited word to its trace parent; a throwaway
      // holder collects the real root as its single child. `shown` tracks which
      // words have already been displayed, so re-visits render as `(dup)`.
      const holder: TraceNode = { word: '', rule: null, dup: false, children: [] };
      const shown = new Set<string>();
      this.getVariations(word, variations, false, holder, shown);
      const result = [...variations];
      const root = holder.children[0];
      if (root) {
        console.log(`${renderTrace(root, result)}\n→ [${result.join(', ')}]`);
      }
      return result;
    }

    this.getVariations(word, variations, false);
    return [...variations];
  }

  // Recurse into a PRODUCED candidate, floored at MIN_CANDIDATE_LENGTH. Below the
  // floor the form is dropped outright (neither added to the result Set nor traced),
  // because nothing reachable from a 0/1-char form is ever a real word: a strip only
  // shortens it, synthesis/nasal-strip require 2+ chars to match. The typed word does
  // NOT come through here — it is added directly by getVariations — so this only ever
  // suppresses garbage, never the query itself.
  private recurse(
    candidate: string,
    variations: Set<string>,
    mePrefixed: boolean,
    traceParent?: TraceNode,
    traceShown?: Set<string>,
    ruleLabel?: string,
  ) {
    if (candidate.length < MIN_CANDIDATE_LENGTH) return;
    this.getVariations(candidate, variations, mePrefixed, traceParent, traceShown, ruleLabel);
  }

  // `traceParent`/`traceShown` drive the optional dev trace: both `undefined`
  // means tracing is off (the production path). When set, this word is attached
  // under `traceParent`; its `dup` flag is keyed on `traceShown` (what the tree
  // has already displayed), NOT on the result Set — see TraceNode.dup for why.
  // Every node keeps tracing its subtree (even a repeat); renderTrace() prunes
  // repeated branches that introduce nothing new.
  private getVariations(
    word: string,
    variations: Set<string>,
    mePrefixed: boolean,
    traceParent?: TraceNode,
    traceShown?: Set<string>,
    ruleLabel?: string,
  ) {
    variations.add(word);

    let childTrace: TraceNode | undefined;
    if (traceParent && traceShown) {
      const seenInTrace = traceShown.has(word);
      if (!seenInTrace) traceShown.add(word);
      const node: TraceNode = { word, rule: ruleLabel ?? null, dup: seenInTrace, children: [] };
      traceParent.children.push(node);
      // Keep tracing even a repeat: re-walking it can surface a brand-new form
      // (a "birth") that exists ONLY inside this re-entered branch — e.g. `ikan`
      // is first created by re-stripping a repeated `berikan`. renderTrace()
      // prunes repeated branches that bear nothing new, so the tree stays compact
      // while still showing each new word at its true point of first creation.
      childTrace = node;
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
            this.recurse(
              match[1],
              variations,
              mePrefixed,
              childTrace,
              traceShown,
              `strip ${rule.label}`,
            );
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
            this.recurse(meWord, variations, true, childTrace, traceShown, rule.label);
          }
          if (rule.alsoBare) {
            this.recurse(
              base,
              variations,
              true,
              childTrace,
              traceShown,
              `${rule.label} (bare root)`,
            );
          }
          break;
        }
        case 'nasal': {
          for (const cand of nasalCandidates(word, rule.stem)) {
            // Note the root-initial consonant that meN-/peN- elided and we
            // restored (e.g. men- + t -> menerima, traced as `nasal men- +t`).
            const restored = cand.restored ? ` +${cand.restored}` : '';
            this.recurse(
              cand.remainder,
              variations,
              mePrefixed,
              childTrace,
              traceShown,
              `nasal ${cand.surface}${restored}`,
            );
          }
          break;
        }

      }
    }
  }
}
