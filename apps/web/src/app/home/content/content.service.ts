import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, filter, map, Observable, of, switchMap } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorAlertService } from '../../shared/api-error-alert.service';
import { LoggerService } from '../../shared/logger.service';
import { type IArticle } from './publication/article/article.model';
import { type ITopic } from './topic.model';

interface ContentManifestEntry {
  filename: string;
  sha: string;
}

const MANIFEST_STORAGE_KEY = 'content-manifest';

@Injectable({
  providedIn: 'root',
})
export class ContentService {
  #http = inject(HttpClient);
  #authService = inject(AuthService);
  #apiErrorAlertService = inject(ApiErrorAlertService);
  #logger = inject(LoggerService);

  constructor() {
    this.#authService.user$
      .pipe(
        takeUntilDestroyed(),
        filter((user) => !user),
      )
      .subscribe(() => {
        this.clearCache();
      });

    this.#authService.user$
      .pipe(
        takeUntilDestroyed(),
        filter((user) => !!user),
        switchMap(() => this.#fetchManifest()),
      )
      .subscribe((manifest) => this.#checkAndBust(manifest));
  }

  clearCache(): void {
    this.#logger.debug('ContentService', 'content cache cleared');
    void this.#clearSwDataCache();
  }

  fetchPublications(): Observable<ITopic[]> {
    return this.#fetchTopics('/api/v1/content/index');
  }

  fetchPublicationTopics(groupName: string): Observable<ITopic[]> {
    return this.#fetchTopics(`/api/v1/content/${groupName}`);
  }

  prefetchArticle(filename: string): Observable<boolean> {
    return this.#http
      .get<IArticle>(`/api/v1/content/article/${filename.replace(/\.md$/, '')}`)
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }

  fetchArticle(filename: string): Observable<IArticle | null> {
    return this.#http
      .get<IArticle>(`/api/v1/content/article/${filename.replace(/\.md$/, '')}`)
      .pipe(
        catchError((error) => {
          this.#apiErrorAlertService.showNetworkError(error);
          return of(null);
        }),
      );
  }

  #fetchTopics(url: string): Observable<ITopic[]> {
    return this.#http.get<ITopic[]>(url).pipe(
      catchError((error) => {
        this.#apiErrorAlertService.showNetworkError(error);
        return of([]);
      }),
    );
  }

  #fetchManifest(): Observable<ContentManifestEntry[]> {
    return this.#http
      .get<ContentManifestEntry[]>('/api/v1/content/manifest')
      .pipe(catchError(() => of([])));
  }

  #checkAndBust(manifest: ContentManifestEntry[]): void {
    if (manifest.length === 0) return;
    const stored = localStorage.getItem(MANIFEST_STORAGE_KEY);
    const serialized = JSON.stringify(manifest);
    if (stored !== serialized) {
      localStorage.setItem(MANIFEST_STORAGE_KEY, serialized);
      if (stored !== null) {
        this.#logger.debug('ContentService', 'content manifest changed — busting SW cache');
        void this.#clearSwDataCache();
      }
    }
  }

  async #clearSwDataCache(): Promise<void> {
    if (!('caches' in globalThis)) return;
    const keys = await caches.keys();
    for (const key of keys) {
      if (key.includes(':data:dynamic:content-api')) {
        await caches.delete(key);
      }
    }
  }
}
