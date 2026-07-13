import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, firstValueFrom, map, of } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { ApiErrorAlertService } from '../../shared/api-error-alert.service';

export interface SrsItem {
  term: string;
  lang: string;
  listId: string;
  back?: string;
  interval: number;
  easeFactor: number;
  dueDate: string;
  reps: number;
  lapses: number;
  /** For a back-less card: which dictionary lemma line to show (default 0). */
  lemmaIndex: number;
}

export interface SrsStatsEntry {
  listId: string;
  due: number;
  new: number;
  total: number;
  /** Cards a study session would actually serve now (due reviews + the day's
   * remaining new-card allotment). This is what the study badge shows. */
  available: number;
}

export type SrsRating = 'again' | 'good' | 'easy';

@Injectable({
  providedIn: 'root',
})
export class StudyService {
  #http = inject(HttpClient);
  #authService = inject(AuthService);
  #apiErrorAlert = inject(ApiErrorAlertService);

  readonly stats = signal<SrsStatsEntry[]>([]);

  constructor() {
    effect(() => {
      if (this.#authService.user()) {
        void this.refreshStats();
      } else {
        this.stats.set([]);
      }
    });
  }

  async refreshStats(): Promise<void> {
    const data = await firstValueFrom(
      this.#http.get<SrsStatsEntry[]>('/api/v1/srs/stats').pipe(catchError(() => of([]))),
    );
    this.stats.set(data);
  }

  getDueCards(listId: string, all = false): Observable<SrsItem[]> {
    const params: Record<string, string> = { listId };
    if (all) params['all'] = 'true';
    return this.#http.get<SrsItem[]>('/api/v1/srs/due', { params }).pipe(
      catchError((error) => {
        // Without this the study modal would open empty, indistinguishable from
        // "nothing due" — tell the user the cards failed to load instead.
        void this.#apiErrorAlert.showNetworkError(error);
        return EMPTY;
      }),
    );
  }

  submitReview(
    term: string,
    lang: string,
    listId: string,
    rating: SrsRating,
  ): Observable<{ dueDate: string }> {
    return this.#http
      .post<{ dueDate: string }>('/api/v1/srs/review', { term, lang, listId, rating })
      .pipe(
        catchError((error) => {
          // A silently dropped review loses the user's rating with no sign it
          // failed. Surface it so they know their progress was not saved.
          void this.#apiErrorAlert.showNetworkError(error);
          return EMPTY;
        }),
      );
  }

  /** The pinned dictionary line for a back-less card (0 = first line). */
  getLemmaIndex(term: string, lang: string, listId: string): Observable<number> {
    return this.#http
      .get<{ lemmaIndex: number }>('/api/v1/srs/lemma-index', { params: { listId, term, lang } })
      .pipe(
        map((r) => r.lemmaIndex),
        catchError(() => of(0)),
      );
  }

  setLemmaIndex(term: string, lang: string, listId: string, lemmaIndex: number): Observable<void> {
    return this.#http
      .post<void>('/api/v1/srs/lemma-index', { term, lang, listId, lemmaIndex })
      .pipe(
        catchError((error) => {
          void this.#apiErrorAlert.showNetworkError(error);
          return EMPTY;
        }),
      );
  }
}
