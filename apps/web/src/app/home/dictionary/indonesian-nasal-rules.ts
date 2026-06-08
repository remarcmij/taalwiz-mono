/**
 * Indonesian meN-/peN- nasal allomorphy — the single source of truth.
 *
 * Both the variation generator (./indonesian-variation-generator.ts, which
 * over-generates root candidates so dictionary lookup succeeds) and the
 * segmenter (./indonesian-segmenter.ts, which finds the one ordered affix path
 * down to a known root) need to undo the same morphophonemic process: the meN-
 * and peN- prefixes assimilate to a root's initial consonant and often ELIDE
 * it, so the surface form no longer visibly contains its root.
 *
 *   meN- + sapu    -> menyapu     (s -> ny, root-initial s elided)
 *   meN- + potong  -> memotong    (p -> m,  root-initial p elided)
 *   meN- + tulis   -> menulis     (t -> n,  root-initial t elided)
 *   meN- + kumpul  -> mengumpul   (k -> ng, root-initial k elided)
 *
 * To recover the root from the surface we strip the prefix allomorph and, where
 * the allomorph implies an elided consonant, restore it. The facts are
 * identical for both consumers, so they live here once. Previously each had its
 * own hand-port; the two drifted into carrying the SAME inverted guard, and the
 * "consistency" test could not catch it because both sides agreed while both
 * were wrong. One table removes that whole failure mode.
 *
 * This module owns BOTH directions of meN- allomorphy:
 *   - nasalCandidates(): SURFACE -> ROOT (strip the prefix, restore the elided
 *     consonant). Used by the variation generator AND the segmenter.
 *   - prefixWithMeN():   ROOT -> SURFACE (build the active meN- form). Used by
 *     the variation generator's di-/-kan reconstruction.
 * They are INVERSES of the same facts, kept as two separate tables (not one):
 * the forward direction carries exemptions (per-, pelajar, kh) the strip
 * direction lacks, so folding them together would contort both. Co-locating
 * them lets the two tables be read against each other so they cannot drift.
 * (peN- has no forward builder; only meN- is reconstructed.)
 *
 * See apps/web/MORPHOLOGY_AID.md for the linguistic grounding (Teeuw).
 */

export interface NasalCandidate {
  /** Candidate remainder after stripping the prefix (a root, or a still-affixed form). */
  remainder: string;
  /** Root-initial consonant restored by undoing assimilation, or null when none was. */
  restored: string | null;
  /** Surface allomorph, for a rule note, e.g. "meny-". */
  surface: string;
}

interface NasalAllomorph {
  /** Onset appended to the stem ('me'/'pe'): 'ng' -> meng-, 'ny' -> meny-, '' -> bare me-/pe-. */
  onset: string;
  /** Consonant elided by assimilation that we restore, or null when the allomorph elides nothing. */
  elided: string | null;
  /**
   * When the remainder matches this, the elided consonant is NOT restored: the
   * surface is a genuine non-eliding allomorph, not an assimilation. `null` means
   * always restore. E.g. meng- before g/h is non-eliding (menggali -> gali), but
   * before a vowel it IS the k-elision case (mengumpul -> kumpul), hence /^[gh]/.
   */
  restoreUnless: RegExp | null;
}

// Ordered MOST-SPECIFIC onset first: 'ng'/'ny' must be tested before 'n', and the
// bare-stem catch-all ('') last. The first matching row wins (we break), which
// exactly reproduces the original if/else-if chains in both consumers.
const NASAL_ALLOMORPHS: NasalAllomorph[] = [
  { onset: 'ng', elided: 'k', restoreUnless: /^[gh]/ },
  { onset: 'ny', elided: 's', restoreUnless: null },
  { onset: 'm', elided: 'p', restoreUnless: /^[bf]/ },
  { onset: 'n', elided: 't', restoreUnless: /^(?:[dcjz]|sy)/ },
  { onset: '', elided: null, restoreUnless: null },
];

/**
 * Candidate remainders after stripping a meN-/peN- nasal prefix, given the stem
 * ('me' or 'pe'). For the matching allomorph this yields: the bare remainder;
 * where the assimilation guard allows, the remainder with the elided root
 * consonant restored (k/s/p/t); and the "bare me-/pe- + nasal-initial root" case
 * (e.g. menganga -> nganga) for the onset variants. Returns [] when nothing matches.
 *
 * Pure and synchronous. Does NOT filter by remainder length — callers that need a
 * minimum length (the segmenter) apply their own guard.
 */
export function nasalCandidates(form: string, stem: string): NasalCandidate[] {
  const res: NasalCandidate[] = [];

  for (const allo of NASAL_ALLOMORPHS) {
    const prefix = stem + allo.onset;
    if (!form.startsWith(prefix)) continue;

    const rest = form.slice(prefix.length);
    res.push({ remainder: rest, restored: null, surface: prefix + '-' });

    if (allo.elided && (!allo.restoreUnless || !allo.restoreUnless.test(rest))) {
      res.push({ remainder: allo.elided + rest, restored: allo.elided, surface: prefix + '-' });
    }

    // bare me-/pe- + nasal-initial root (menganga -> nganga). Not for the bare-stem
    // row, whose first push already strips exactly the stem.
    if (allo.onset) {
      res.push({ remainder: form.slice(2), restored: null, surface: stem + '-' });
    }

    break; // first matching onset wins (replicates the original else-if chain)
  }

  return res;
}

// ---------------------------------------------------------------------------
// ROOT -> SURFACE: build the active meN- form. The inverse of nasalCandidates,
// keyed by the ROOT's initial instead of the surface allomorph. First matching
// row wins, so order matters: the per-/pelajar- and kh exceptions sit before
// their generic rows, /^t/ before the other men- onsets, and /^sy/ (handled in
// the men- row) before /^s/ so it is not mistaken for s-elision.
// ---------------------------------------------------------------------------

interface ForwardMeN {
  /** Matches the root's initial onset. */
  onset: RegExp;
  /** The meN- allomorph this onset selects: me-, mem-, men-, meny-, meng-. */
  prefix: string;
  /** Whether the root-initial consonant is dropped (assimilated into the nasal). */
  elide: boolean;
}

const ACTIVE_MEN_RULES: ForwardMeN[] = [
  { onset: /^[aeiou]/, prefix: 'meng', elide: false }, // vowel: meng-, nothing elided
  { onset: /^[bf]/, prefix: 'mem', elide: false },
  { onset: /^(?:per|pelajar)/, prefix: 'mem', elide: false }, // exception: p kept
  { onset: /^p/, prefix: 'mem', elide: true }, // p -> m
  { onset: /^t/, prefix: 'men', elide: true }, // t -> n (before the other men- onsets)
  { onset: /^(?:d|c|j|z|sy)/, prefix: 'men', elide: false }, // before /^s/: sy is not s-elision
  { onset: /^s/, prefix: 'meny', elide: true }, // s -> ny
  { onset: /^k[^h]/, prefix: 'meng', elide: true }, // k -> ng, but not kh
  { onset: /^(?:g|h|kh|k)/, prefix: 'meng', elide: false }, // g/h/kh (and bare k): meng-, kept
  { onset: /^[lrmnwy]/, prefix: 'me', elide: false }, // liquids/nasals/glides (n subsumes ny-, ng-)
];

/**
 * Build the active meN- form of a root, e.g. sapu -> menyapu, kumpul -> mengumpul,
 * potong -> memotong. Returns the root unchanged when no onset rule matches (e.g.
 * a non-letter initial). Pure and synchronous. Inverse of nasalCandidates(.., 'me').
 */
export function prefixWithMeN(root: string): string {
  for (const rule of ACTIVE_MEN_RULES) {
    if (rule.onset.test(root)) {
      return rule.prefix + (rule.elide ? root.slice(1) : root);
    }
  }
  return root;
}
