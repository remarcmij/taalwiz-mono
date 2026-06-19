import type { ResolvedCard } from '../../study/card-definition.service';

/**
 * Strip the lemma text's leading bold headword when it merely repeats the surface
 * term, so a bare root does not render as "**abad** **abad**, 1 eeuw". A homonym
 * roman numeral ("abang I,") and a different root headword (the common case for a
 * derived form, "dianggap" -> "**anggap** ...") are kept — informative, not
 * duplicated.
 */
export function stripLeadingHeadword(text: string, term: string): string {
  const m = text.match(/^\*\*([^*]+)\*\*/);
  if (!m) return text;
  const headwords = m[1].split(',').map((h) => h.trim().toLowerCase());
  if (!headwords.includes(term.toLowerCase())) return text;
  return text.slice(m[0].length).replace(/^[\s,]+/, '');
}

/** Append a period when a line lacks terminal punctuation. */
function ensureTerminalPeriod(s: string): string {
  const trimmed = s.replace(/\s+$/, '');
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Build the markdown content line for one deck card. A curated back is shown with
 * the term prefixed (unless the back already contains it); a back-less card uses
 * its resolved lemma line plus the affix decomposition. A back-less card the
 * dictionary cannot resolve (typo / post-1996 coinage) keeps its term, flagged with
 * `notFoundLabel` — a lightweight, at-a-glance QA check the reader doubles as. The
 * term is wrapped in `<strong class="not-found">` (bold + struck-through, but NOT a
 * `<span>`, so it stays black and non-tappable: a lookup would be futile) and the
 * label `_..._` (muted italic), since neither is a real, searchable dictionary word.
 * The strikethrough is raw HTML, not markdown `~~...~~`, because that renders to
 * `<del>`, which the reader repurposes as a quiz fill-in blank.
 */
export function buildCardContentLine(
  term: string,
  back: string | undefined,
  resolved: ResolvedCard | null,
  notFoundLabel: string,
): string {
  if (back) {
    const termCore = term.replace(/[^\p{L}\p{N} ]/gu, '').trim().toLowerCase();
    const backHasTerm = termCore !== '' && back.replace(/\*/g, '').toLowerCase().includes(termCore);
    return ensureTerminalPeriod(backHasTerm ? back : `**${term}** ${back}`);
  }

  const lemma = resolved?.lemma;
  if (!lemma) return `<strong class="not-found">${term}</strong> _(${notFoundLabel})_`;

  const definition = stripLeadingHeadword(lemma.text, term).replace(/[;,]\s*$/, '');
  const root = lemma.baseWord;
  // Bold the root morpheme so it stays tappable (e.g. "peN- + **acara**"); affixes
  // are plain text. The root element equals the segmenter's anchor (baseWord).
  const deco = resolved?.breakdown
    ? ` (${resolved.breakdown.morphemes.map((m) => (m === root ? `**${m}**` : m)).join(' + ')})`
    : '';
  return ensureTerminalPeriod(`**${term}**${deco} ${definition}`);
}
