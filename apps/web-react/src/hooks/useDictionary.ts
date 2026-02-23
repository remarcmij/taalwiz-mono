import { useCallback, useState } from 'react';
import { searchDictionary, fetchSuggestions } from '../api/dictionary.api.ts';
import { useAuth } from './useAuth.ts';
import {
  LookupResult,
  WordLang,
  type ILemma,
  type LookupResponse,
} from '../types/models.ts';

const LIMIT = 50;

function makeLookupResult(response: LookupResponse): LookupResult {
  const newResult = new LookupResult();
  newResult.haveMore = response.haveMore;

  for (const lemma of response.lemmas) {
    const base = new WordLang(lemma.baseWord, lemma.baseLang);
    const { key } = base;

    if (!newResult.lemmas[key]) {
      newResult.lemmas[key] = [];
      newResult.bases.push(base);
    }
    newResult.lemmas[key]!.push(lemma);
  }

  return newResult;
}

function mergeLookupResult(
  combinedResult: LookupResult,
  nextResult: LookupResult,
): LookupResult {
  combinedResult.haveMore = nextResult.haveMore;

  nextResult.bases.forEach((base) => {
    const { key } = base;

    const newLemmas = nextResult.lemmas[key]!;
    const prevLemmas = combinedResult.lemmas[key];
    if (!prevLemmas) {
      combinedResult.lemmas[key] = newLemmas;
      combinedResult.bases.push(base);
    } else {
      combinedResult.lemmas[key] = prevLemmas.concat(newLemmas);
    }
  });

  return combinedResult;
}

function reorderLookupResult(result: LookupResult) {
  const headBase = result.bases.find(
    (base) => base.key === result.targetBase!.key,
  );
  if (headBase) {
    const otherBases = result.bases.filter(
      (base) => base.key !== result.targetBase!.key,
    );
    result.bases = [headBase, ...otherBases];
  }
}

export function useDictionary() {
  const { getAccessToken } = useAuth();
  const [result, setResult] = useState<LookupResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const lookup = useCallback(
    async (target: WordLang) => {
      setIsSearching(true);
      let skip = 0;
      const combinedResult = new LookupResult();
      combinedResult.targetBase = target;

      let haveMore = true;

      while (haveMore) {
        try {
          const data = await searchDictionary(
            target.word,
            target.lang,
            getAccessToken,
            { skip, limit: LIMIT },
          );
          const nextResult = makeLookupResult(data);
          mergeLookupResult(combinedResult, nextResult);
          reorderLookupResult(combinedResult);
          setResult({ ...combinedResult });
          haveMore = nextResult.haveMore;
          skip += LIMIT;
        } catch {
          haveMore = false;
        }
      }

      setIsSearching(false);
    },
    [getAccessToken],
  );

  const getSuggestions = useCallback(
    async (term: string) => {
      return fetchSuggestions(term, getAccessToken);
    },
    [getAccessToken],
  );

  return { result, lookup, getSuggestions, isSearching };
}

// Also export search for word click modal usage
export async function searchDictionaryKeyword(
  word: string,
  lang: string,
  getToken: () => Promise<string | null>,
): Promise<{ word: string; lang: string; lemmas: ILemma[] }> {
  const data = await searchDictionary(word, lang, getToken, { keyword: true });
  return { word: data.word, lang: data.lang, lemmas: data.lemmas };
}
