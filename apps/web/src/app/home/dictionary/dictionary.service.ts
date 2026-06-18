import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable } from 'rxjs';

import { langConfig } from '../../app.constants';
import { DictStoreService } from './dict-store.service';
import { getTraceLevel } from './indonesian-variation-generator';
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

    // Suggestions are a literal prefix match on what was typed -- no variation
    // generation. Generating variations of a partially-typed word surfaces
    // alphabetical neighbours of stripped forms (e.g. "memperbai" strips -i to
    // "memperba" and suggests unrelated "memperba*" words), which reads as a
    // broken filter. Inflected forms still resolve via the variation generator
    // on the lookup path
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
        merged.push(new WordLang(hit.word, hit.lang, hit.isSupplement));
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
    const fromGenerator = target.lang !== langConfig.nativeLang;
    const words = fromGenerator
      ? langConfig.variationGenerator.getWordVariations(word)
      : word.split(',').map((w) => w.trim());

    let foundWord: string | null = null;
    let found: LookupResult | null = null;
    for (const w of words) {
      const lemmas = await this.#dictStore.findByWordAndLang(w, target.lang);
      if (lemmas.some((l) => (l.keyword ?? 1) === 1)) {
        foundWord = w;
        found = makeLookupResult({ word: w, lang: target.lang, lemmas, haveMore: false });
        found.targetBase = target;
        break;
      }
    }

    if (fromGenerator) {
      this.#logVariations(word, words, foundWord);
    }

    return found ?? result;
  }

  async #fetchWordLemmasAsync(word: string, lang: string): Promise<LookupResponse> {
    const fromGenerator = lang !== langConfig.nativeLang;
    const variations = fromGenerator
      ? langConfig.variationGenerator.getWordVariations(word)
      : word.split(',').map((w) => w.trim());

    let result: LookupResponse | null = null;
    for (const keywordOnly of [true, false]) {
      for (const w of variations) {
        const lemmas = await this.#dictStore.findByWordAndLang(w, lang, keywordOnly);
        if (lemmas.length > 0) {
          result = { word: w, lang, lemmas, haveMore: false };
          break;
        }
      }
      if (result) break;
    }

    if (fromGenerator) {
      this.#logVariations(word, variations, result?.word ?? null);
    }

    return result ?? { word, lang, lemmas: [], haveMore: false };
  }

  // Dev trace (gated, off by default): the variation generator's output for a
  // target-language lookup, with the matched variation flagged by a leading '='
  // -- the same marker the multiple-choice quiz uses for the correct option. Used
  // by both the search box (#searchLocal) and the word-click modal
  // (#fetchWordLemmasAsync). Logged at trace level >= 1; the recursive tree (level
  // 2) is printed separately by the variation generator. See getTraceLevel().
  #logVariations(word: string, variations: string[], foundWord: string | null) {
    if (getTraceLevel() < 1) return;
    const marked = variations.map((w) => (w === foundWord ? `=${w}` : w));
    console.log(`${word} -> [${marked.map((w) => `'${w}'`).join(', ')}]`);
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

  // Mark a base as new only when every lemma under it is a supplement, so a
  // headword that also exists in core Teeuw (e.g. "aplikasi") stays unmarked.
  for (const base of newResult.bases) {
    const lemmas = newResult.lemmas[base.key];
    base.isSupplement = lemmas.length > 0 && lemmas.every((l) => l.isSupplement);
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
