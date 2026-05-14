import { inject, Injectable } from '@angular/core';
import { from, Observable, Subject } from 'rxjs';

import { DictStoreService } from './dict-store.service';
import { IndonesianStemmer } from './indonesian-stemmer';
import { type ILemma } from './lemma/lemma.model';
import { WordLang } from './word-lang.model';

class LookupResult {
  targetBase: WordLang | null = null;
  bases: WordLang[] = [];
  lemmas: Record<string, ILemma[]> = {};
  haveMore = false;
}

interface LookupResponse {
  word: string;
  lang: string;
  lemmas: ILemma[];
  haveMore: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class DictionaryService {
  #dictStore = inject(DictStoreService);

  #lookupResult$ = new Subject<LookupResult>();
  lookupResult$ = this.#lookupResult$.asObservable();

  lookup({ word, lang }: WordLang) {
    this.searchDictionary(new WordLang(word, lang));
  }

  fetchSuggestions(term: string): Observable<WordLang[]> {
    return from(this.#fetchSuggestionsAsync(term));
  }

  searchDictionary(target: WordLang, searchWord?: string) {
    from(this.#searchLocal(target, searchWord)).subscribe((result) => {
      reorderLookupResult(result);
      this.#lookupResult$.next(result);
    });
  }

  fetchWordLemmas(word: string, lang: string): Observable<LookupResponse> {
    return from(this.#fetchWordLemmasAsync(word, lang));
  }

  async #fetchSuggestionsAsync(term: string): Promise<WordLang[]> {
    const idVariations = new IndonesianStemmer().getWordVariations(term);
    const seen = new Set<string>();
    const results: WordLang[] = [];

    for (const variation of idVariations) {
      const hits = await this.#dictStore.findWordsStartingWith(variation, 'id', 10);
      for (const hit of hits) {
        const key = hit.word + '|' + hit.lang;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(new WordLang(hit.word, hit.lang));
        }
        if (results.length >= 10) break;
      }
      if (results.length >= 10) break;
    }

    if (results.length < 10) {
      const nlHits = await this.#dictStore.findWordsStartingWith(
        term.toLowerCase(),
        'nl',
        10 - results.length,
      );
      for (const hit of nlHits) {
        const key = hit.word + '|' + hit.lang;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(new WordLang(hit.word, hit.lang));
        }
      }
    }

    return results;
  }

  async #searchLocal(target: WordLang, searchWord?: string): Promise<LookupResult> {
    const result = new LookupResult();
    result.targetBase = target;

    const word = searchWord ?? target.word;
    const words =
      target.lang === 'nl'
        ? word.split(',').map((w) => w.trim())
        : new IndonesianStemmer().getWordVariations(word);

    for (const w of words) {
      const lemmas = await this.#dictStore.findByWordAndLang(w, target.lang);
      if (lemmas.length > 0) {
        const found = makeLookupResult({ word: w, lang: target.lang, lemmas, haveMore: false });
        found.targetBase = target;
        return found;
      }
    }

    return result;
  }

  async #fetchWordLemmasAsync(word: string, lang: string): Promise<LookupResponse> {
    const variations =
      lang === 'nl'
        ? word.split(',').map((w) => w.trim())
        : new IndonesianStemmer().getWordVariations(word);
    for (const w of variations) {
      const lemmas = await this.#dictStore.findByWordAndLang(w, lang, true);
      if (lemmas.length > 0) {
        return { word: w, lang, lemmas, haveMore: false };
      }
    }
    return { word, lang, lemmas: [], haveMore: false };
  }
}

function makeLookupResult(response: LookupResponse) {
  const newResult = new LookupResult();
  newResult.haveMore = response.haveMore;

  for (const lemma of response.lemmas) {
    const base = new WordLang(lemma.baseWord, lemma.baseLang);
    const { key } = base;

    if (!newResult.lemmas[key]) {
      newResult.lemmas[key] = [];
      newResult.bases.push(base);
    }
    newResult.lemmas[key].push(lemma);
  }

  return newResult;
}

function reorderLookupResult(result: LookupResult) {
  const headBase = result.bases.find((base) => base.key === result.targetBase!.key);
  if (headBase) {
    const otherBases = result.bases.filter((base) => base.key !== result.targetBase!.key);
    result.bases = [headBase, ...otherBases];
  }
}
