import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, filter, map, Observable, of, switchMap } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { ApiErrorAlertService } from '../../shared/api-error-alert.service';
import { LoggerService } from '../../shared/logger.service';
import { type Article } from './publication/article/article.model';
import { type Topic } from './topic.model';

// One entry per topic in the server's content manifest. The `sha` changes
// whenever a topic's content changes, so comparing manifests detects staleness
// without downloading the content itself.
interface ContentManifestEntry {
  filename: string;
  sha: string;
}

// localStorage key holding the last-seen manifest, used to diff against the
// freshly fetched one on login (see #checkAndBust).
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
    // On logout (user becomes null), drop the cached content so the next user
    // on this device can't read the previous user's group-gated articles.
    this.#authService.user$
      .pipe(
        takeUntilDestroyed(),
        filter((user) => !user),
      )
      .subscribe(() => {
        this.clearCache();
      });

    // On login, fetch the manifest and bust the SW cache if the content has
    // changed since last visit, so stale articles don't linger offline.
    this.#authService.user$
      .pipe(
        takeUntilDestroyed(),
        filter((user) => !!user),
        switchMap(() => this.#fetchManifest()),
      )
      .subscribe((manifest) => this.#checkAndBust(manifest));
  }

  // Public entry point (also called on logout) to evict the SW's cached
  // content-API responses.
  clearCache(): void {
    this.#logger.debug('ContentService', 'content cache cleared');
    void this.#clearSwDataCache();
  }

  // The list of publications the current user may see.
  fetchPublications(): Observable<Topic[]> {
    return this.#fetchTopics('/api/v1/content/index');
  }

  // The topics (manifest + ordered articles) within one publication.
  fetchPublicationTopics(groupName: string): Observable<Topic[]> {
    return this.#fetchTopics(`/api/v1/content/${groupName}`);
  }

  // Warms the SW cache for an article without surfacing it. Errors resolve to
  // `false` and stay silent (no alert) since this is a best-effort prefetch.
  prefetchArticle(filename: string): Observable<boolean> {
    return this.#http
      .get<Article>(`/api/v1/content/article/${filename.replace(/\.md$/, '')}`)
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }

  // Fetches a single article for display. Unlike prefetch, a failure here is
  // user-visible, so it raises a network-error alert and resolves to null.
  fetchArticle(filename: string): Observable<Article | null> {
    return this.#http
      .get<Article>(`/api/v1/content/article/${filename.replace(/\.md$/, '')}`)
      .pipe(
        catchError((error) => {
          this.#apiErrorAlertService.showNetworkError(error);
          return of(null);
        }),
      );
  }

  // Shared topic-list fetch. On error, alerts and returns an empty list so
  // callers can render an empty state rather than breaking.
  #fetchTopics(url: string): Observable<Topic[]> {
    return this.#http.get<Topic[]>(url).pipe(
      catchError((error) => {
        this.#apiErrorAlertService.showNetworkError(error);
        return of([]);
      }),
    );
  }

  // Fetches the content manifest for staleness checking. Errors are swallowed
  // to an empty array (no alert) — a failed check just skips cache busting.
  #fetchManifest(): Observable<ContentManifestEntry[]> {
    return this.#http
      .get<ContentManifestEntry[]>('/api/v1/content/manifest')
      .pipe(catchError(() => of([])));
  }

  // Compares the fetched manifest against the last-stored one and busts the SW
  // cache when it changed. An empty manifest (fetch failed) is ignored so a
  // transient error never wipes the cache. The `stored !== null` guard skips
  // busting on the very first run, when there is nothing cached yet to be stale.
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

  // Deletes the service worker's dynamic content-API cache entries by key
  // substring, leaving app-shell and other caches intact. No-ops where the
  // Cache API is unavailable (e.g. SSR or an unsupported browser).
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
