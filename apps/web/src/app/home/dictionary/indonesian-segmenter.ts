/**
 * Indonesian affix SEGMENTER.
 *
 * Given a SURFACE word (e.g. "menyapukan") and a KNOWN, dictionary-attested ROOT
 * (e.g. "sapu"), produce a FLAT morphological breakdown: prefixes, the root, and
 * suffixes in surface order, e.g. ["meN-", "sapu", "-kan"].
 *
 * This is deliberately NOT a stemmer. The production `IndonesianVariationGenerator`
 * (./indonesian-variation-generator.ts) over-generates an unordered Set of candidate
 * roots to make dictionary lookup succeed. This segmenter does the opposite: the root
 * is a fixed input (the lemma's `baseWord`, already attested by Teeuw), and we find the
 * single best ordered affix path from surface down to exactly that root. It never
 * invents a root; failure yields `null`.
 *
 * The meN-/peN- nasal allomorphy (which surface allomorph elides which root
 * consonant) is shared with the variation generator via ./indonesian-nasal-rules.ts,
 * so both undo assimilation from one table. This file adds only the ordered-path
 * search and the rule-note shaping on top of those candidates.
 *
 * See apps/web/MORPHOLOGY_AID.md for the design and its grounding in Teeuw.
 */

import { nasalCandidates } from './indonesian-nasal-rules';
import { takesBeAllomorph } from './indonesian-ber-rules';

/** Restored-consonant note for meN-/peN- allomorphy, parameterised for i18n. */
export interface SegmentRuleNote {
  /** Archiphoneme label, e.g. "meN-". */
  archiphoneme: string;
  /** Surface allomorph, e.g. "meny-". */
  surface: string;
  /** Root-initial consonant that was elided then restored, e.g. "s". */
  letter: string;
}

export interface SegmentResult {
  /** Ordered morphemes: [prefix..., root, suffix...]. */
  morphemes: string[];
  /** Display string, e.g. "meN- + sapu + -kan". */
  display: string;
  /** Present only when a nasal prefix restored a dropped root consonant. */
  ruleNote?: SegmentRuleNote;
}

interface SimpleAffix {
  label: string;
  /** Capture group 1 = the remainder after stripping. */
  match: RegExp;
}

// Suffixes (peeled from the right). Clitics/particles are outermost; the
// derivational suffixes -kan/-an/-i are innermost. The {N,} guards mirror the
// variation generator's remainder-length guards (e.g. -an requires a 3+ char remainder).
const SUFFIXES: SimpleAffix[] = [
  { label: '-nya', match: /^(.{2,})nya$/ },
  { label: '-ku', match: /^(.{2,})ku$/ },
  { label: '-kau', match: /^(.{2,})kau$/ },
  { label: '-mu', match: /^(.{2,})mu$/ },
  { label: '-lah', match: /^(.{2,})lah$/ },
  { label: '-kah', match: /^(.{2,})kah$/ },
  { label: '-tah', match: /^(.{2,})tah$/ },
  { label: '-pun', match: /^(.{2,})pun$/ },
  { label: '-kan', match: /^(.{2,})kan$/ },
  { label: '-an', match: /^(.{3,})an$/ },
  { label: '-i', match: /^(.{2,})i$/ },
];

// Non-nasal prefixes (peeled from the left). meN-/peN- are handled separately
// because of their consonant allomorphy.
const SIMPLE_PREFIXES: SimpleAffix[] = [
  { label: 'di-', match: /^di(.{2,})$/ },
  { label: 'ke-', match: /^ke(.{2,})$/ },
  { label: 'se-', match: /^se(.{2,})$/ },
  { label: 'ter-', match: /^ter(.{2,})$/ },
  { label: 'ber-', match: /^ber(.{2,})$/ },
  { label: 'per-', match: /^per(.{2,})$/ },
  { label: 'kau-', match: /^kau(.{2,})$/ },
  { label: 'ku-', match: /^ku(.{2,})$/ },
  { label: 'mu-', match: /^mu(.{2,})$/ },
];

const NASAL_PREFIXES = [
  { archiphoneme: 'meN-', stem: 'me' },
  { archiphoneme: 'peN-', stem: 'pe' },
];

interface Solution {
  prefixes: string[];
  suffixes: string[];
  ruleNote?: SegmentRuleNote;
}

/**
 * Segment `surface` against a KNOWN `root`. Pure and synchronous.
 *
 * Returns null when no affix path reaches the root, or when the analysis is
 * genuinely ambiguous between materially different breakdowns of the same minimal
 * length (silence is safer than a confident guess). Reduplication is out of scope
 * for v1 (returns null).
 *
 * DEFERRED — compounds: this is anchored to a SINGLE root, so a compound stem of two
 * roots dead-ends and returns null. E.g. `mencampuradukkan` = meN- + campur + aduk +
 * -kan, but Teeuw files it under the single base `campur`; peeling meN-/-kan lands on
 * the residual `campuraduk` != `campur` -> null. A compound-aware version would split
 * the residual into base + further ATTESTED roots (`aduk` is its own headword),
 * validating each against the dictionary. That needs a root-existence predicate, which
 * would break this function's pure/synchronous, no-dictionary-access property — hence
 * deferred, alongside reduplication, which needs the same machinery. See
 * apps/web/MORPHOLOGY_AID.md section 8.
 */
export function segmentIndonesian(surface: string, root: string): SegmentResult | null {
  // The surface is user-tapped text, so normalise it to lowercase. The root keeps
  // its dictionary casing: a capitalised base is a proper noun (e.g. "Besar", the
  // calendar month, vs "besar", "big"), and a lowercase surface cannot derive from
  // it, so it correctly yields no breakdown rather than a spurious one.
  const s = surface.trim().toLowerCase();
  const r = root.trim();

  if (!s || !r) return null;
  if (s === r) return { morphemes: [r], display: r };

  const solutions: Solution[] = [];

  // DFS that peels affixes from both ends until `form` equals `r`. Every strip
  // shortens `form`, so the recursion always terminates. `prefixes` are recorded
  // outer->inner (append on left-strip); `suffixes` outer->inner means we prepend
  // on right-strip so the array stays in left-to-right (root-adjacent first) order.
  const dfs = (
    form: string,
    prefixes: string[],
    suffixes: string[],
    ruleNote: SegmentRuleNote | undefined,
  ): void => {
    if (form === r) {
      solutions.push({ prefixes: [...prefixes], suffixes: [...suffixes], ruleNote });
      return;
    }
    // Stripping only shortens; once we are at/below the root length we cannot reach it.
    if (form.length <= r.length) return;

    for (const suffix of SUFFIXES) {
      const m = form.match(suffix.match);
      if (m) {
        dfs(m[1], prefixes, [suffix.label, ...suffixes], ruleNote);
      }
    }

    for (const prefix of SIMPLE_PREFIXES) {
      const m = form.match(prefix.match);
      if (m) {
        dfs(m[1], [...prefixes, prefix.label], suffixes, ruleNote);
      }
    }

    // ber- has a be- allomorph (the -r elides) before r-initial or
    // -er-first-syllable roots: bekerja = ber- + kerja, berumah = ber- + rumah.
    // Guarded via the shared predicate so it never mis-segments be-initial
    // non-derivations (betapa, begitu). Labelled by the ber- archiphoneme, the
    // same way the nasal prefixes label by meN-/peN- regardless of surface.
    const beMatch = form.match(/^be(.{2,})$/);
    if (beMatch && takesBeAllomorph(beMatch[1])) {
      dfs(beMatch[1], [...prefixes, 'ber-'], suffixes, ruleNote);
    }

    // bel- allomorph: a closed lexical exception, only "ajar" (belajar) and the
    // rare "unjur" (belunjur).
    const belMatch = form.match(/^bel(.{2,})$/);
    if (belMatch && (belMatch[1] === 'ajar' || belMatch[1] === 'unjur')) {
      dfs(belMatch[1], [...prefixes, 'ber-'], suffixes, ruleNote);
    }

    // meN-/peN- are always the OUTERMOST prefix in Indonesian, so only try them
    // when no prefix has been peeled yet (suffixes may already be off).
    if (prefixes.length === 0) {
      for (const np of NASAL_PREFIXES) {
        for (const cand of nasalCandidates(form, np.stem)) {
          if (cand.remainder.length < 2) continue;
          const note = cand.restored
            ? { archiphoneme: np.archiphoneme, surface: cand.surface, letter: cand.restored }
            : ruleNote;
          dfs(cand.remainder, [np.archiphoneme], suffixes, note);
        }
      }
    }
  };

  dfs(s, [], [], undefined);

  return select(solutions, r);
}

/** Pick the minimal, unambiguous analysis; return null on a material tie. */
function select(solutions: Solution[], root: string): SegmentResult | null {
  if (solutions.length === 0) return null;

  const counted = solutions.map((sol) => ({
    sol,
    count: sol.prefixes.length + 1 + sol.suffixes.length,
  }));
  const min = Math.min(...counted.map((c) => c.count));
  const best = counted.filter((c) => c.count === min).map((c) => c.sol);

  // Collapse identical label-sequences (different DFS routes, same analysis).
  const distinct = new Map<string, Solution>();
  for (const sol of best) {
    const key = sol.prefixes.join('|') + '>' + sol.suffixes.join('|');
    if (!distinct.has(key)) distinct.set(key, sol);
  }
  if (distinct.size !== 1) return null;

  const chosen = [...distinct.values()][0];
  const morphemes = [...chosen.prefixes, root, ...chosen.suffixes];
  const result: SegmentResult = { morphemes, display: morphemes.join(' + ') };
  if (chosen.ruleNote) result.ruleNote = chosen.ruleNote;
  return result;
}
