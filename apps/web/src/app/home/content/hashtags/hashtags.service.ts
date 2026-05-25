import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';

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
  #apiErrorAlertService = inject(ApiErrorAlertService);

  getHashtagIndex(): Observable<HashtagGroup[]> {
    return this.#http.get<HashtagGroup[]>('/api/v1/hashtags').pipe(
      catchError((error) => {
        this.#apiErrorAlertService.showNetworkError(error);
        return of([]);
      }),
    );
  }

  findHashtag(name: string): Observable<IHashtag[]> {
    return this.#http.get<IHashtag[]>(`/api/v1/hashtags/${name}`).pipe(
      catchError((error) => {
        this.#apiErrorAlertService.showNetworkError(error);
        return of([]);
      }),
    );
  }
}
