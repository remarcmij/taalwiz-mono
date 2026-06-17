import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';

import { AuthService } from '../auth/auth.service';

const DEFAULT_NEW_CARDS_PER_DAY = 20;

/**
 * Client-side cache of the server `user-preferences` document. Currently only
 * the SRS daily new-card cap; reads on login, writes through on change.
 */
@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  readonly #http = inject(HttpClient);
  readonly #auth = inject(AuthService);

  readonly newCardsPerDay = signal<number>(DEFAULT_NEW_CARDS_PER_DAY);

  constructor() {
    effect(() => {
      if (this.#auth.user()) void this.#load();
      else this.newCardsPerDay.set(DEFAULT_NEW_CARDS_PER_DAY);
    });
  }

  async setNewCardsPerDay(value: number): Promise<void> {
    await firstValueFrom(this.#http.patch('/api/v1/user-preferences', { newCardsPerDay: value }));
    this.newCardsPerDay.set(value);
  }

  async #load(): Promise<void> {
    const data = await firstValueFrom(
      this.#http
        .get<{ newCardsPerDay: number }>('/api/v1/user-preferences')
        .pipe(catchError(() => of({ newCardsPerDay: DEFAULT_NEW_CARDS_PER_DAY }))),
    );
    this.newCardsPerDay.set(data.newCardsPerDay ?? DEFAULT_NEW_CARDS_PER_DAY);
  }
}
