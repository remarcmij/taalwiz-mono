import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { EMPTY, catchError, switchMap, take } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

export interface BookmarkEntry {
  word: string;
  lang: string;
  listName: string;
  savedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class BookmarkService {
  #http = inject(HttpClient);
  #authService = inject(AuthService);

  readonly bookmarks = signal<BookmarkEntry[]>([]);
  readonly bookmarkedKeys = signal<Set<string>>(new Set());
  readonly isEnabled = computed(() => !!this.#authService.user());

  constructor() {
    effect(() => {
      if (this.#authService.user()) {
        this.#loadBookmarks();
      } else {
        this.bookmarks.set([]);
        this.bookmarkedKeys.set(new Set());
      }
    });
  }

  isBookmarked(word: string, lang: string): boolean {
    return this.bookmarkedKeys().has(`${word}:${lang}`);
  }

  toggle(word: string, lang: string): void {
    this.isBookmarked(word, lang) ? this.#remove(word, lang) : this.#add(word, lang);
  }

  #add(word: string, lang: string): void {
    const key = `${word}:${lang}`;
    const entry: BookmarkEntry = { word, lang, listName: 'default', savedAt: new Date().toISOString() };
    this.bookmarkedKeys.update((s) => new Set([...s, key]));
    this.bookmarks.update((bs) => [entry, ...bs]);
    this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        headers.get('Authorization')
          ? this.#http.post('/api/v1/bookmarks', { word, lang }, { headers })
          : EMPTY,
      ),
      catchError(() => {
        this.bookmarkedKeys.update((s) => { const n = new Set(s); n.delete(key); return n; });
        this.bookmarks.update((bs) => bs.filter((b) => !(b.word === word && b.lang === lang)));
        return EMPTY;
      }),
      take(1),
    ).subscribe();
  }

  #remove(word: string, lang: string): void {
    const key = `${word}:${lang}`;
    const snapshot = this.bookmarks();
    this.bookmarkedKeys.update((s) => { const n = new Set(s); n.delete(key); return n; });
    this.bookmarks.update((bs) => bs.filter((b) => !(b.word === word && b.lang === lang)));
    this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        headers.get('Authorization')
          ? this.#http.delete('/api/v1/bookmarks', { headers, params: { word, lang } })
          : EMPTY,
      ),
      catchError(() => {
        this.bookmarkedKeys.update((s) => new Set([...s, key]));
        this.bookmarks.set(snapshot);
        return EMPTY;
      }),
      take(1),
    ).subscribe();
  }

  #loadBookmarks(): void {
    this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        headers.get('Authorization')
          ? this.#http.get<BookmarkEntry[]>('/api/v1/bookmarks', { headers })
          : EMPTY,
      ),
      catchError(() => EMPTY),
      take(1),
    ).subscribe((entries) => {
      this.bookmarks.set(entries);
      this.bookmarkedKeys.set(new Set(entries.map((e) => `${e.word}:${e.lang}`)));
    });
  }
}
