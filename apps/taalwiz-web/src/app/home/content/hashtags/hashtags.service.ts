import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of, switchMap } from 'rxjs';

import { AuthService } from '../../../auth/auth.service';
import { ApiErrorAlertService } from '../../../shared/api-error-alert.service';
import { type IHashtag } from './hashtag.model';

export interface HashtagGroup {
  _id: string;
  tags: { name: string; count: number }[];
}

@Injectable({
  providedIn: 'root',
})
export class HashtagsService {
  #http = inject(HttpClient);
  #authService = inject(AuthService);
  #apiErrorAlertService = inject(ApiErrorAlertService);

  getHashtagIndex(): Observable<HashtagGroup[]> {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of([]);
        }
        return this.#http
          .get<HashtagGroup[]>('/api/v1/hashtags', { headers })
          .pipe(
            catchError((error) => {
              this.#apiErrorAlertService.showError(error);
              return of([]);
            })
          );
      })
    );
  }

  findHashtag(name: string): Observable<IHashtag[]> {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of([]);
        }
        return this.#http
          .get<IHashtag[]>(`/api/v1/hashtags/${name}`, {
            headers,
          })
          .pipe(
            catchError((error) => {
              this.#apiErrorAlertService.showError(error);
              return of([]);
            })
          );
      })
    );
  }
}
