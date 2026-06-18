import type { ResolvedCard } from '../../study/card-definition.service';

/**
 * Strip the lemma text's leading bold headword when it merely repeats the surface
 * term, so a bare root does not render as "**abad** **abad**, 1 eeuw". A homonym
 * roman numeral ("abang I,") and a different root headword (the common case for a
 * derived form, "dianggap" -> "**anggap** ...") are kept — informative, not
 * duplicated. Ported from the wordlist-content compiler tool.
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
 * Build the markdown content line for one deck card, mirroring the wordlist-content
 * tool. A curated back is shown with the term prefixed (unless the back already
 * contains it); a back-less card uses its resolved lemma line plus the affix
 * decomposition. An unresolved back-less card keeps its bare (tappable) term so the
 * word is never silently lost.
 */
export function buildCardContentLine(
  term: string,
  back: string | undefined,
  resolved: ResolvedCard | null,
): string {
  if (back) {
    const termCore = term.replace(/[^\p{L}\p{N} ]/gu, '').trim().toLowerCase();
    const backHasTerm = termCore !== '' && back.replace(/\*/g, '').toLowerCase().includes(termCore);
    return ensureTerminalPeriod(backHasTerm ? back : `**${term}** ${back}`);
  }

  const lemma = resolved?.lemma;
  if (!lemma) return `**${term}**`;

  const definition = stripLeadingHeadword(lemma.text, term).replace(/[;,]\s*$/, '');
  const root = lemma.baseWord;
  // Bold the root morpheme so it stays tappable (e.g. "peN- + **acara**"); affixes
  // are plain text. The root element equals the segmenter's anchor (baseWord).
  const deco = resolved?.breakdown
    ? ` (${resolved.breakdown.morphemes.map((m) => (m === root ? `**${m}**` : m)).join(' + ')})`
    : '';
  return ensureTerminalPeriod(`**${term}**${deco} ${definition}`);
}
