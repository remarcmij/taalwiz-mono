import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { catchError, map, of, Subject, switchMap } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
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

  #lookupResult$ = new Subject<LookupResult>();
  lookupResult$ = this.#lookupResult$.asObservable();

  lookup({ word, lang }: WordLang) {
    this.searchDictionary(new WordLang(word, lang));
  }

  fetchSuggestions(term: string) {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        this.#http.get<WordLang[]>(`/api/v1/dictionary/autocomplete/${term}`, {
          headers,
        })
      )
    );
  }

  searchDictionary(target: WordLang) {
    let skip = 0;
    const combinedResult = new LookupResult();
    combinedResult.targetBase = target;

    const doSearch = () => {
      this.execSearchRequest({
        word: target.word,
        lang: target.lang,
        skip,
        limit: LIMIT,
      })
        .pipe(
          map((data) => makeLookupResult(data)),
          map((nextResult) => mergeLookupResult(combinedResult, nextResult)),
          catchError((error) => {
            this.handleError(error);
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

  private handleError(_error: any) {
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

function mergeLookupResult(
  combinedResult: LookupResult,
  nextResult: LookupResult
) {
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
  const headBase = result.bases.find(
    (base) => base.key === result.targetBase!.key
  );
  if (headBase) {
    const otherBases = result.bases.filter(
      (base) => base.key !== result.targetBase!.key
    );
    result.bases = [headBase, ...otherBases];
  }
}
