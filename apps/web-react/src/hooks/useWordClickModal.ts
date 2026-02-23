import { useCallback, useRef, useState } from 'react';
import { searchDictionaryKeyword } from './useDictionary.ts';
import { useAuth } from './useAuth.ts';
import { IndonesianStemmer } from '../lib/indonesian-stemmer.ts';
import { foreignLang } from '../constants.ts';
import type { ILemma } from '../types/models.ts';

const removeAccents = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function cleanseTerm(term: string): string {
  const match = term.match(/[-'()a-zA-Z\u00C0-\u00FF]{2,}/g);
  if (match) {
    term = match[0];
  }
  term = term.trim().toLowerCase();
  return (
    term.replace(/\(.*?\)/g, '').replace(/[()]/g, '') ||
    term.replace(/[()]/g, '')
  );
}

export interface WordClickResult {
  clickedWord: string;
  word: string;
  lang: string;
  sentence: string;
  lemmas: ILemma[];
}

export function useWordClickModal() {
  const { getAccessToken } = useAuth();
  const [modalData, setModalData] = useState<WordClickResult | null>(null);
  const clickedTargetRef = useRef<HTMLElement | null>(null);

  const onClicked = useCallback(
    async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const sentence = target.parentElement?.textContent?.trim() ?? '';

      let word = target.innerText.trim();
      word = cleanseTerm(word);
      if (!word) return;

      const lang = foreignLang;

      // Highlight clicked word
      target.classList.add('clicked');
      clickedTargetRef.current = target;

      try {
        const parser = new IndonesianStemmer();
        const variations = parser.getWordVariations(removeAccents(word));
        const searchWord = variations.join(',');
        const response = await searchDictionaryKeyword(
          searchWord,
          lang,
          getAccessToken,
        );
        setModalData({
          clickedWord: word,
          word: response.word,
          lang: response.lang,
          sentence,
          lemmas: response.lemmas,
        });
      } catch {
        // Remove highlight on error
        target.classList.remove('clicked');
        clickedTargetRef.current = null;
      }
    },
    [getAccessToken],
  );

  const dismissModal = useCallback(() => {
    setModalData(null);
    if (clickedTargetRef.current) {
      clickedTargetRef.current.classList.remove('clicked');
      clickedTargetRef.current = null;
    }
  }, []);

  return { modalData, onClicked, dismissModal };
}
