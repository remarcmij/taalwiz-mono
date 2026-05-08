import { Injectable } from '@angular/core';

import { type IArticle } from '../home/content/publication/article/article.model';

import { register } from 'swiper/element/bundle';
register();

const BEGIN_MARKER_REGEXP = /<!-- flashcard -->/;
const END_MARKER_REGEXP = /<!-- end-flashcard -->/;
const HEADING_REGEXP = /^#+\s*(.*)$/;
const FOREIGN_FRAGMENT_REGEXP = /\*\*(.+?)\*\*/;
const ALL_FOREIGN_FRAGMENT_REGEXP = /\*\*(.+?)\*\*/g;
const UNORDERED_LIST_REGEXP = /^-/m;
const PARENTHESIZED_REGEXP = /\(.*?\)/g;

export interface Flashcard {
  key: number;
  title?: string;
  prompt: FlashcardText;
  answer: FlashcardText;
}

export interface FlashcardText {
  text: string;
  lang: string;
  isForeign: boolean;
}

export interface FlashcardData {
  index: number;
  foreignText: string;
  nativeText: string;
}

export interface FlashcardSection {
  title: string;
  flashcards: FlashcardData[];
}

export type flashCardMode = 'foreignFirst' | 'nativeFirst';

// Fisher-Yates Shuffle Algorithm
export function shuffle<T>(array: T[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

@Injectable({
  providedIn: 'root',
})
export class FlashcardService {
  isSpeaking = false;

  constructor() {}

  toggleIsSpeaking() {
    this.isSpeaking = !this.isSpeaking;
  }

  hasFlashCards(article: IArticle): boolean {
    return article.htmlText?.indexOf(`<!-- flashcard -->`) !== -1;
  }

  formatFlashcard(
    data: FlashcardData,
    baseLang: string,
    foreignLang: string,
    mode: flashCardMode = 'nativeFirst',
  ): Flashcard {
    let flashCard: Flashcard;
    if (mode === 'nativeFirst') {
      flashCard = {
        prompt: {
          text: data.nativeText,
          lang: baseLang,
          isForeign: false,
        },
        answer: {
          text: data.foreignText,
          lang: foreignLang,
          isForeign: true,
        },
        key: uniqueId(),
      };
    } else {
      flashCard = {
        prompt: {
          text: data.foreignText,
          lang: foreignLang,
          isForeign: true,
        },
        answer: {
          text: data.nativeText,
          lang: baseLang,
          isForeign: false,
        },
        key: uniqueId(),
      };
    }

    return flashCard;
  }

  extractFlashcards(htmlText: string) {
    let text = htmlText;
    let match = text.match(BEGIN_MARKER_REGEXP);
    const flashcards: FlashcardSection[] = [];

    while (match) {
      // strip off all textup to and including the begin marker
      text = text.slice(match.index! + match[0].length);

      match = text.match(END_MARKER_REGEXP);
      if (match) {
        const lines = text.slice(0, match.index).split('\n');
        const isUnorderedList = UNORDERED_LIST_REGEXP.test(text);
        const section = isUnorderedList
          ? this.getUnorderListFlashCardSection(lines)
          : this.getSingleLineFlashCardSection(lines);

        flashcards.unshift(section);
      }

      match = text.match(BEGIN_MARKER_REGEXP);
    }

    return flashcards;
  }

  private getSingleLineFlashCardSection(lines: string[]) {
    let title = '';
    let index = 0;
    const flashcards: FlashcardData[] = [];

    for (const line of lines) {
      let foreignText: string;
      let nativeText: string;

      let match = line.match(HEADING_REGEXP);

      if (match) {
        title = match[1];
      } else {
        match = FOREIGN_FRAGMENT_REGEXP.exec(line);
        if (match) {
          foreignText = match[1];
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

  private getUnorderListFlashCardSection(lines: string[]) {
    let title = '';
    let index = 0;
    const flashcards: FlashcardData[] = [];

    let i = 0;
    const len = lines.length;

    while (i < len) {
      let line = lines[i].replace(PARENTHESIZED_REGEXP, '');
      i += 1;

      const match = line.match(HEADING_REGEXP);
      if (match) {
        title = match[1];
      } else if (/^-/.test(line)) {
        const prompt = line.substring(1).trim();
        let answer = '';
        while (i < len) {
          line = lines[i];
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
}

// https://stackoverflow.com/questions/3231459/how-can-i-create-unique-ids-with-javascript
const uniqueId = (length = 16) => {
  return parseInt(
    Math.ceil(Math.random() * Date.now())
      .toPrecision(length)
      .toString()
      .replace('.', ''),
  );
};
