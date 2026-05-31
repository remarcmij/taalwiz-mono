import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable } from 'rxjs';

import { langConfig } from '../../app.constants';
import { DictStoreService } from './dict-store.service';
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

  #lookupResult$ = new BehaviorSubject<LookupResult | null>(null);
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
    const prefix = term.toLowerCase();

    // Suggestions are a literal prefix match on what was typed -- no stemmer
    // variations. Stemming a partially-typed word surfaces alphabetical
    // neighbours of stripped forms (e.g. "memperbai" strips -i to "memperba"
    // and suggests unrelated "memperba*" words), which reads as a broken filter.
    // Inflected forms still resolve via the stemmer on the lookup path
    // (#searchLocal), reached by tapping a word, tapping a suggestion, or
    // pressing Enter with no matching suggestion.
    //
    // Both languages carry equal weight: target and native hits are merged and
    // sorted alphabetically so they interleave, rather than listing all target
    // matches first. The user can narrow to one language simply by typing more.
    const [targetHits, nativeHits] = await Promise.all([
      this.#dictStore.findWordsStartingWith(prefix, langConfig.targetLang, 10),
      this.#dictStore.findWordsStartingWith(prefix, langConfig.nativeLang, 10),
    ]);

    const seen = new Set<string>();
    const merged: WordLang[] = [];
    for (const hit of [...targetHits, ...nativeHits]) {
      const key = hit.word + '|' + hit.lang;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(new WordLang(hit.word, hit.lang));
      }
    }

    merged.sort((a, b) =>
      a.word.toLowerCase().localeCompare(b.word.toLowerCase()),
    );

    return merged.slice(0, 10);
  }

  async #searchLocal(target: WordLang, searchWord?: string): Promise<LookupResult> {
    const result = new LookupResult();
    result.targetBase = target;

    const word = searchWord ?? target.word;
    const words =
      target.lang === langConfig.nativeLang
        ? word.split(',').map((w) => w.trim())
        : langConfig.stemmer.getWordVariations(word);

    for (const w of words) {
      const lemmas = await this.#dictStore.findByWordAndLang(w, target.lang);
      if (lemmas.some((l) => (l.keyword ?? 1) === 1)) {
        const found = makeLookupResult({ word: w, lang: target.lang, lemmas, haveMore: false });
        found.targetBase = target;
        return found;
      }
    }

    return result;
  }

  async #fetchWordLemmasAsync(word: string, lang: string): Promise<LookupResponse> {
    const variations =
      lang === langConfig.nativeLang
        ? word.split(',').map((w) => w.trim())
        : langConfig.stemmer.getWordVariations(word);
    for (const keywordOnly of [true, false]) {
      for (const w of variations) {
        const lemmas = await this.#dictStore.findByWordAndLang(w, lang, keywordOnly);
        if (lemmas.length > 0) {
          return { word: w, lang, lemmas, haveMore: false };
        }
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
  const headBase =
    result.bases.find((base) => result.lemmas[base.key].some((l) => l.keyword === 1)) ??
    result.bases.find((base) => base.key === result.targetBase!.key);
  if (headBase) {
    const otherBases = result.bases.filter((base) => base.key !== headBase.key);
    result.bases = [headBase, ...otherBases];
  }
}
