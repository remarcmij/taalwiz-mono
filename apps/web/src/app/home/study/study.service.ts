import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, firstValueFrom, of } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

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
}

export interface SrsStatsEntry {
  listId: string;
  due: number;
  new: number;
  total: number;
}

export type SrsRating = 'again' | 'good' | 'easy';

@Injectable({
  providedIn: 'root',
})
export class StudyService {
  #http = inject(HttpClient);
  #authService = inject(AuthService);

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
    return this.#http.get<SrsItem[]>('/api/v1/srs/due', { params }).pipe(catchError(() => EMPTY));
  }

  submitReview(
    term: string,
    lang: string,
    listId: string,
    rating: SrsRating,
  ): Observable<{ dueDate: string }> {
    return this.#http
      .post<{ dueDate: string }>('/api/v1/srs/review', { term, lang, listId, rating })
      .pipe(catchError(() => EMPTY));
  }
}
