// Teeuw's editorial apparatus, stripped from a Dutch fragment before counting
// content words: abbreviations, the sense-numbering Roman numerals (I-X), and the
// single-letter language-origin codes (N, A, E, ...). None of these are translation words.
export const EDITORIAL_MARKERS_NL = new Set([
  'A', // Arabisch
  'C', // Chinees (Maleis)
  'E', // Engels
  'J', // Jakartaans (Bataviaas) Maleis/Indonesisch
  'Jp', // Japans
  'Jv', // Javaans
  'M', // Minangkabaus
  'Ml', // (hedendaags Maleisisch
  'N', // Nederlands
  'O', // Ouder Maleis
  'P', // Populair, Spreektaal, Vulgair
  'S', // Soendaas
  'afk', // afkorting (van)
  'bep', // bepaald(e)
  'bez', // bezittelijk
  'bv', // bijvoorbeeld
  'dgl', // dergelijk(e)
  'div', // divers(e)
  'dmv', // door middel van
  'dwz', // dat wil zeggen
  'ea', // en andere
  'ed', // en dergelijke
  'enk', // enkelvoud
  'enz', // enzovoort
  'etc', // etcetera
  'euf', // eufemistisch
  'evt', // eventueel
  'fig', // figuurlijk
  'id', // idem
  'iem', // iemand
  'iems', // iemands
  'ihb', // in het bijzonder
  'ipv', // in plaats van
  'isl', // islamitisch
  'itt', // in tegenstelling tot
  'lett', // letterlijk
  'lit', // literair
  'mv', // meervoud
  'nl', // namelijk
  'oa', // onder andere
  'pc', // protestants-christelijk
  'rk', // rooms-katholiek
  'resp', // respectievelijk
  'scheldw', // scheldwoord
  'ssv', // soorten van
  'sv', // soort van
  'taalk', // taalkunde, taalkundig
  'tgo', // tegenover
  'vb', // voorbeeld
  'vbb', // voorbeelden
  'vgl', // vergelijk
  'vnl', // voornamelijk
  'vnwd', // voornaamwoord
  'zgn', // zogenaamd(e)
  'I', // 1
  'II', // 2
  'III', // 3
  'IV', // 4
  'V', // 5
  'VI', // 6
  'VII', // 7
  'VIII', // 8
  'IX', // 9
  'X', // 10
]);

// Common Dutch words used ONLY to disambiguate a multi-word fragment down to a single
// content word (see selectTargetWord). They are NOT globally ignored: a word standing
// alone in a fragment is still indexed even if it appears here.
export const COMMON_WORDS_NL = new Set([
  'de',
  'het',
  'een',
  'zich',
  'zijn',
  // 'is',
  'in',
  // 'van',
  // 'met',
  // 'op',
  'hebben',
  // 'maken',
  // 'doen',
  // 'aan',
  // 'voor',
  // 'laten',
  // 'te',
  'elkaar',
  // 'naar',
  'iets',
  'iemand',
  // 'als',
  // 'tot',
  // 'gaan',
  // 'en',
  // 'of',
  // 'brengen',
  // 'bij',
  // 'worden',
  // 'geven',
  // 'niet',
  // 'over',
  // 'tegen',
  // 'om',
  // 'houden',
  // 'nemen',
  // 'door',
  // 'dat',
  // 'wat',
  // 'komen',
  // 'soort',
  // 'uit',
  // 'zitten',
  // 'goed',
  // 'ten',
  // 'onder',
  // 'nemen',
  'er',
]);

export const IGNORED_WORDS_ID = new Set(['di', 'tidak', 'nya']);

// --- Stevens (Indonesian -> English) ---------------------------------------
// Stevens' own editorial apparatus that can leak into an English fragment as a
// PLAIN word (most markers are already `_italic_`/`__bold__`-wrapped and so are
// dropped by the tokenizer; this catches the few that appear bare). Stripped
// before counting content words in selectTargetWord. Hand-tunable, like the NL
// lists above.
export const EDITORIAL_MARKERS_EN = new Set([
  'a)', // enumerated sense markers a), b), c) ...
  'b)',
  'c)',
  'd)',
  'esp', // especially
  'usu', // usually
  'etc', // etcetera
  'cf', // confer (compare)
  'eg', // for example
  'ie', // that is
  'fig', // figurative(ly)
  'lit', // literal(ly)
  'abbr', // abbreviation
  'var', // variant
  'I', // sense-numbering Roman numerals (when not __-wrapped)
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
]);

// Common English words used ONLY to disambiguate a multi-word fragment down to a
// single content word (see selectTargetWord). NOT globally ignored: a word
// standing alone in a fragment is still indexed even if it appears here.
export const COMMON_WORDS_EN = new Set([
  'a',
  'an',
  'the',
  'to',
  'of',
  'for',
  'in',
  'on',
  'at',
  'with',
  'one',
  "one's",
]);

// Hard-ignored English function words that are never a valid standalone gloss
// and would otherwise be indexed via the single-word rule in selectTargetWord
// (e.g. the `and` bridging two headwords in `**X** and **Y**`, or a lone `he`
// fragment). Dropped unconditionally, before the fragment's word count is taken,
// so they also clean up multi-word disambiguation.
//
// Deliberately EXCLUDES prepositions (in, on, at, by, to, of, for, with) and
// content-bearing verbs (have, can, will, must, may): those legitimately gloss
// Indonesian words (di -> in/at/on, ke -> to, harus -> must) and stay indexable.
export const IGNORED_WORDS_EN = new Set([
  // articles & coordinating connectors
  'and',
  'or',
  'nor',
  'the',
  'an',
  // copula / `be` forms
  'be',
  'is',
  'am',
  'are',
  'was',
  'were',
  'been',
  'being',
  // auxiliary `do`
  'do',
  'does',
  'did',
  // pronouns (subject / object / possessive)
  'he',
  'she',
  'we',
  'they',
  'it',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'his',
  'its',
  'our',
  'their',
  // non-prepositional particles / subordinators
  'as',
  'if',
  'so',
]);
