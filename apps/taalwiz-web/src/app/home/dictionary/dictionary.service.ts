import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { catchError, from, map, Observable, of, Subject, switchMap } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { DictStoreService } from './dict-store.service';
import { IndonesianStemmer } from './indonesian-stemmer';
import { type ILemma } from './lemma/lemma.model';
import { WordLang } from './word-lang.model';

interface SearchRequest {
  word: string;
  lang: string;
  keyword?: boolean;
  skip?: number;
  limit?: number;
}

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

const LIMIT = 50;

@Injectable({
  providedIn: 'root',
})
export class DictionaryService {
  #http = inject(HttpClient);
  #authService = inject(AuthService);
  #alertCtrl = inject(AlertController);
  #translate = inject(TranslateService);
  #dictStore = inject(DictStoreService);

  #lookupResult$ = new Subject<LookupResult>();
  lookupResult$ = this.#lookupResult$.asObservable();

  lookup({ word, lang }: WordLang) {
    this.searchDictionary(new WordLang(word, lang));
  }

  fetchSuggestions(term: string): Observable<WordLang[]> {
    return from(this.#dictStore.count()).pipe(
      switchMap(async (count) => {
        if (count > 0) {
          const prefixes = new IndonesianStemmer().getWordVariations(term);

          const seen = new Set<string>();
          const results: WordLang[] = [];

          for (const prefix of prefixes) {
            const hits = await this.#dictStore.findByPrefix(prefix, 'id', 10);
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

          return results;
        }
        return null;
      }),
      switchMap((results) => {
        if (results !== null) return of(results);
        return this.#authService.getRequestHeaders().pipe(
          switchMap((headers) =>
            this.#http.get<WordLang[]>(`/api/v1/dictionary/autocomplete/${term}`, {
              headers,
            })
          )
        );
      })
    );
  }

  searchDictionary(target: WordLang, searchWord?: string) {
    from(this.#dictStore.count())
      .pipe(
        switchMap(async (count) => {
          if (count > 0) {
            const result = await this.searchLocal(target, searchWord);
            reorderLookupResult(result);
            return result;
          }
          return null;
        })
      )
      .subscribe((result) => {
        if (result !== null) {
          this.#lookupResult$.next(result);
        } else {
          this.searchViaApi(target, searchWord);
        }
      });
  }

  private async searchLocal(target: WordLang, searchWord?: string): Promise<LookupResult> {
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

  private searchViaApi(target: WordLang, searchWord?: string) {
    let skip = 0;
    const combinedResult = new LookupResult();
    combinedResult.targetBase = target;

    const doSearch = () => {
      this.execSearchRequest({
        word: searchWord ?? target.word,
        lang: target.lang,
        skip,
        limit: LIMIT,
      })
        .pipe(
          map((data) => makeLookupResult(data)),
          map((nextResult) => mergeLookupResult(combinedResult, nextResult)),
          catchError(() => {
            this.handleError();
            combinedResult.haveMore = false;
            return of(combinedResult);
          })
        )
        .subscribe((results) => {
          reorderLookupResult(results);
          this.#lookupResult$.next(results);
          if (results.haveMore) {
            skip += LIMIT;
            doSearch();
          }
        });
    };

    doSearch();
  }

  private handleError() {
    this.#alertCtrl
      .create({
        header: this.#translate.instant('common.search-alert-header'),
        message: this.#translate.instant('common.search-alert-message'),
        buttons: [this.#translate.instant('common.close')],
      })
      .then((alertEl) => {
        alertEl.present();
      });
  }

  fetchWordLemmas(word: string, lang: string): Observable<LookupResponse> {
    return from(this.#dictStore.count()).pipe(
      switchMap(async (count): Promise<LookupResponse | null> => {
        if (count > 0) {
          const variations =
            lang === 'nl'
              ? word.split(',').map((w) => w.trim())
              : new IndonesianStemmer().getWordVariations(word);
          for (const w of variations) {
            const lemmas = await this.#dictStore.findByWordAndLang(w, lang);
            if (lemmas.length > 0) {
              return { word: w, lang, lemmas, haveMore: false };
            }
          }
          return { word, lang, lemmas: [], haveMore: false };
        }
        return null;
      }),
      switchMap((result) => {
        if (result !== null) return of(result);
        return this.execSearchRequest({ word, lang, keyword: true });
      })
    );
  }

  execSearchRequest(searchRequest: SearchRequest) {
    const { word, lang, keyword, skip, limit } = searchRequest;
    let params = new HttpParams();

    if (keyword !== undefined) {
      params = params.set('keyword', keyword ? '1' : '0');
    }

    if (typeof skip === 'number') {
      params = params.set('skip', String(skip));
    }

    if (typeof limit === 'number') {
      params = params.set('limit', String(limit));
    }

    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        const url = `/api/v1/dictionary/find/${encodeURIComponent(
          word
        )}/${encodeURIComponent(lang)}`;
        return this.#http.get<LookupResponse>(url, {
          headers,
          params,
        });
      })
    );
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

function mergeLookupResult(combinedResult: LookupResult, nextResult: LookupResult) {
  combinedResult.haveMore = nextResult.haveMore;

  nextResult.bases.forEach((base) => {
    const { key } = base;

    const newLemmas = nextResult.lemmas[key];
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

// Ensure the target base is the first one in the list
function reorderLookupResult(result: LookupResult) {
  const headBase = result.bases.find((base) => base.key === result.targetBase!.key);
  if (headBase) {
    const otherBases = result.bases.filter((base) => base.key !== result.targetBase!.key);
    result.bases = [headBase, ...otherBases];
  }
}
