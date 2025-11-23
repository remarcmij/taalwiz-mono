import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, filter, Observable, of, switchMap, tap } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorAlertService } from '../../shared/api-error-alert.service';
import { LoggerService } from '../../shared/logger.service';
import { type IArticle } from './publication/article/article.model';
import { type ITopic } from './topic.model';

type IndexListNode = { type: 'index'; topics: ITopic[] };
type ArticleNode = { type: 'article'; article: IArticle };
type CacheNode = IndexListNode | ArticleNode;

@Injectable({
  providedIn: 'root',
})
export class ContentService {
  #http = inject(HttpClient);
  #authService = inject(AuthService);
  #apiErrorAlertService = inject(ApiErrorAlertService);
  #logger = inject(LoggerService);

  #contentCache = new Map<string, CacheNode>();

  constructor() {
    this.#authService.user$
      .pipe(
        takeUntilDestroyed(),
        filter((user) => !user)
      )
      .subscribe(() => {
        this.clearCache();
      });
  }

  clearCache() {
    this.#contentCache.clear();
    this.#logger.debug('ContentService', 'content cache cleared');
  }

  private fetchTopics(url: string): Observable<ITopic[]> {
    return this.#authService.requestHeaders$.pipe(
      switchMap((headers) => {
        if (!headers) {
          return of([]);
        }
        const cached = this.#contentCache.get(url);
        if (cached) {
          if (cached.type === 'index') {
            this.#logger.silly('ContentService', `cache hit: ${url}`);
            return of(cached.topics);
          } else {
            return of([]);
          }
        }
        this.#logger.silly('ContentService', `cache miss: ${url}`);
        return this.#http.get<ITopic[]>(url, { headers }).pipe(
          tap((topics) => {
            this.#contentCache.set(url, { type: 'index', topics });
          })
        );
      }),
      catchError((error) => {
        this.#apiErrorAlertService.showError(error);
        return of([]);
      })
    );
  }

  fetchPublications(): Observable<ITopic[]> {
    return this.fetchTopics('/api/v1/content/index');
  }

  fetchPublicationTopics(groupName: string): Observable<ITopic[]> {
    return this.fetchTopics(`/api/v1/content/${groupName}`);
  }

  fetchArticle(filename: string): Observable<IArticle | null> {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of(null);
        }
        const url = `/api/v1/content/article/${filename}`;
        const cached = this.#contentCache.get(url);
        if (cached) {
          if (cached.type === 'article') {
            this.#logger.silly('ContentService', `cache hit: ${url}`);
            return of(cached.article);
          } else {
            return of(null);
          }
        }
        this.#logger.silly('ContentService', `cache miss: ${url}`);

        return this.#http.get<IArticle>(url, { headers }).pipe(
          tap((article) => {
            this.#contentCache.set(url, { type: 'article', article });
          })
        );
      }),
      catchError((error) => {
        this.#apiErrorAlertService.showError(error);
        return of(null);
      })
    );
  }
}
