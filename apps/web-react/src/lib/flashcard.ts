import type {
  Flashcard,
  FlashcardData,
  FlashcardMode,
  FlashcardSection,
} from '../types/models.ts';

const BEGIN_MARKER_REGEXP = /<!-- flashcard -->/;
const END_MARKER_REGEXP = /<!-- end-flashcard -->/;
const HEADING_REGEXP = /^#+\s*(.*)$/;
const FOREIGN_FRAGMENT_REGEXP = /\*\*(.+?)\*\*/;
const ALL_FOREIGN_FRAGMENT_REGEXP = /\*\*(.+?)\*\*/g;
const UNORDERED_LIST_REGEXP = /^-/m;
const PARENTHESIZED_REGEXP = /\(.*?\)/g;

// Fisher-Yates Shuffle Algorithm
export function shuffle<T>(array: T[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}

export function hasFlashCards(htmlText: string): boolean {
  return htmlText?.indexOf('<!-- flashcard -->') !== -1;
}

export function formatFlashcard(
  data: FlashcardData,
  baseLang: string,
  foreignLang: string,
  mode: FlashcardMode = 'nativeFirst',
): Flashcard {
  if (mode === 'nativeFirst') {
    return {
      prompt: { text: data.nativeText, lang: baseLang, isForeign: false },
      answer: { text: data.foreignText, lang: foreignLang, isForeign: true },
      key: data.index,
    };
  } else {
    return {
      prompt: { text: data.foreignText, lang: foreignLang, isForeign: true },
      answer: { text: data.nativeText, lang: baseLang, isForeign: false },
      key: data.index,
    };
  }
}

export function extractFlashcards(htmlText: string): FlashcardSection[] {
  let text = htmlText;
  let match = text.match(BEGIN_MARKER_REGEXP);
  const flashcards: FlashcardSection[] = [];

  while (match) {
    text = text.slice(match.index! + match[0].length);

    match = text.match(END_MARKER_REGEXP);
    if (match) {
      const lines = text.slice(0, match.index).split('\n');
      const isUnorderedList = UNORDERED_LIST_REGEXP.test(text);
      const section = isUnorderedList
        ? getUnorderedListFlashCardSection(lines)
        : getSingleLineFlashCardSection(lines);

      flashcards.unshift(section);
    }

    match = text.match(BEGIN_MARKER_REGEXP);
  }

  return flashcards;
}

function getSingleLineFlashCardSection(lines: string[]): FlashcardSection {
  let title = '';
  let index = 0;
  const flashcards: FlashcardData[] = [];

  for (const line of lines) {
    let foreignText: string;
    let nativeText: string;

    let match = line.match(HEADING_REGEXP);

    if (match) {
      title = match[1]!;
    } else {
      match = FOREIGN_FRAGMENT_REGEXP.exec(line);
      if (match) {
        foreignText = match[1]!;
        nativeText =
          line.slice(0, match.index) +
          line.slice(match.index! + match[0].length);
        flashcards.push({
          index: index++,
          foreignText: foreignText.trim(),
          nativeText: nativeText.trim(),
        });
      }
    }
  }

  return { title, flashcards };
}

function getUnorderedListFlashCardSection(lines: string[]): FlashcardSection {
  let title = '';
  let index = 0;
  const flashcards: FlashcardData[] = [];

  let i = 0;
  const len = lines.length;

  while (i < len) {
    let line = lines[i]!.replace(PARENTHESIZED_REGEXP, '');
    i += 1;

    const match = line.match(HEADING_REGEXP);
    if (match) {
      title = match[1]!;
    } else if (/^-/.test(line)) {
      const prompt = line.substring(1).trim();
      let answer = '';
      while (i < len) {
        line = lines[i]!;
        i += 1;
        if (line.trim().length === 0) {
          break;
        }
        line = line.replace(PARENTHESIZED_REGEXP, '').trim();
        if (line.length === 0) {
          continue;
        }
        if (answer.length > 0) {
          answer += '\n';
        }
        answer += line;
      }

      let foreignText: string;
      let nativeText: string;
      if (FOREIGN_FRAGMENT_REGEXP.test(prompt)) {
        foreignText = prompt.replace(ALL_FOREIGN_FRAGMENT_REGEXP, '$1');
        nativeText = answer.replace(ALL_FOREIGN_FRAGMENT_REGEXP, '$1');
      } else {
        foreignText = answer.replace(ALL_FOREIGN_FRAGMENT_REGEXP, '$1');
        nativeText = prompt.replace(ALL_FOREIGN_FRAGMENT_REGEXP, '$1');
      }

      flashcards.push({
        index: index++,
        foreignText: foreignText.trim(),
        nativeText: nativeText.trim(),
      });
    }
  }

  return { title, flashcards };
}
