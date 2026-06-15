/**
 * The ber- prefix has a be- allomorph: the -r elides before a root that begins
 * with /r/ (ber + ragam -> beragam, ber + rumah -> berumah) or whose first
 * syllable ends in -er (ber + kerja -> bekerja, ber + ternak -> beternak,
 * ber + serta -> beserta). The separate bel- allomorph before "ajar" (-> belajar)
 * is a lexical one-off handled in the segmenter, not here.
 *
 * This guard is shared by BOTH the variation generator (which strips the
 * allomorph on the lookup path) and the segmenter (which peels it on the
 * breakdown path), so the two can never diverge. The guard is what keeps the
 * allomorph from mis-firing on common be-initial NON-derivations such as
 * `betapa`, `begitu`, or `belum`, whose roots are neither r-initial nor
 * -er-first-syllable.
 *
 * Mirrors the shared-table approach already used for meN-/peN- allomorphy in
 * ./indonesian-nasal-rules.ts. See apps/web/MORPHOLOGY_AID.md.
 */

// The root shapes that trigger the allomorph, as an un-anchored regex BODY so it
// can be reused both as a standalone test and as a lookahead in the strip pattern.
const BE_ALLOMORPH_BODY = 'r.|[^aeiou]*er[^aeiou]';

const BE_ALLOMORPH_ROOT = new RegExp(`^(?:${BE_ALLOMORPH_BODY})`);

/** True when `root` takes the be- allomorph of ber- (so ber+root elides to be+root). */
export function takesBeAllomorph(root: string): boolean {
  return BE_ALLOMORPH_ROOT.test(root);
}

/**
 * Strip pattern for the variation generator: matches a surface `be` + root where
 * the root takes the allomorph, capturing the FULL root (including a root-initial
 * r). Anchored and bounded like the sibling affix strips.
 */
export const BE_ALLOMORPH_STRIP = new RegExp(`^be(?=${BE_ALLOMORPH_BODY})(.{2,})$`);
