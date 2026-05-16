import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { EMPTY, catchError, firstValueFrom, of, switchMap, take } from 'rxjs';
import { AuthService } from '../../auth/auth.service';

export interface VocabularyEntry {
  term: string;
  lang: string;
  listId: string;
  back?: string;
  savedAt: string;
}

export interface VocabularyList {
  id: string;
  name: string;
  count: number;
}

const PREFS_KEY = 'vocabularyCurrentListId';

@Injectable({
  providedIn: 'root',
})
export class VocabularyService {
  #http = inject(HttpClient);
  #authService = inject(AuthService);

  readonly bookmarks = signal<VocabularyEntry[]>([]);
  readonly bookmarkedKeys = signal<Set<string>>(new Set());
  readonly lists = signal<VocabularyList[]>([]);
  readonly currentListId = signal<string | null>(null);
  readonly currentList = computed(() => this.lists().find((l) => l.id === this.currentListId()) ?? null);
  readonly isEnabled = computed(() => !!this.#authService.user() && this.currentListId() !== null);

  constructor() {
    effect(() => {
      if (this.#authService.user()) {
        void this.#initLists();
      } else {
        this.lists.set([]);
        this.currentListId.set(null);
        void Preferences.remove({ key: PREFS_KEY });
        this.bookmarks.set([]);
        this.bookmarkedKeys.set(new Set());
      }
    });
  }

  isBookmarked(term: string, lang: string): boolean {
    return this.bookmarkedKeys().has(`${term}:${lang}`);
  }

  toggle(term: string, lang: string): void {
    if (!this.currentListId()) return;
    this.isBookmarked(term, lang) ? this.#remove(term, lang) : this.#add(term, lang);
  }

  setCurrentList(id: string): void {
    this.currentListId.set(id);
    void Preferences.set({ key: PREFS_KEY, value: id });
    this.#syncServerPrefs(id);
    this.#loadItems(id);
  }

  createList(name: string): void {
    this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        headers.get('Authorization')
          ? this.#http.post<VocabularyList>('/api/v1/vocabulary/lists', { name }, { headers })
          : EMPTY,
      ),
      catchError(() => EMPTY),
      take(1),
    ).subscribe((list) => {
      this.lists.update((ls) => [...ls, list]);
      if (this.currentListId() === null) {
        this.setCurrentList(list.id);
      }
    });
  }

  deleteList(id: string): void {
    const snapshot = this.lists();
    const wasCurrent = this.currentListId() === id;
    this.lists.update((ls) => ls.filter((l) => l.id !== id));

    if (wasCurrent) {
      const remaining = this.lists();
      const next = remaining.length > 0 ? remaining[0].id : null;
      this.currentListId.set(next);
      if (next) {
        void Preferences.set({ key: PREFS_KEY, value: next });
        this.#loadItems(next);
      } else {
        void Preferences.remove({ key: PREFS_KEY });
        this.bookmarks.set([]);
        this.bookmarkedKeys.set(new Set());
      }
    }

    this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        headers.get('Authorization')
          ? this.#http.delete(`/api/v1/vocabulary/lists/${id}`, { headers })
          : EMPTY,
      ),
      catchError(() => {
        this.lists.set(snapshot);
        return EMPTY;
      }),
      take(1),
    ).subscribe();
  }

  renameList(id: string, newName: string): void {
    const snapshot = this.lists();
    this.lists.update((ls) => ls.map((l) => (l.id === id ? { ...l, name: newName } : l)));

    this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        headers.get('Authorization')
          ? this.#http.patch(`/api/v1/vocabulary/lists/${id}`, { name: newName }, { headers })
          : EMPTY,
      ),
      catchError(() => {
        this.lists.set(snapshot);
        return EMPTY;
      }),
      take(1),
    ).subscribe();
  }

  async #initLists(): Promise<void> {
    const [loadedLists, serverPrefs] = await Promise.all([
      this.#fetchLists(),
      this.#fetchServerPrefs(),
    ]);
    this.lists.set(loadedLists);

    // Server preference wins; fall back to local Capacitor Preferences; fall back to first list.
    const { value: localId } = await Preferences.get({ key: PREFS_KEY });
    const candidateId = serverPrefs ?? localId;

    let resolved: string | null = null;
    if (candidateId && loadedLists.some((l) => l.id === candidateId)) {
      resolved = candidateId;
    } else if (loadedLists.length > 0) {
      resolved = loadedLists[0].id;
    }
    this.currentListId.set(resolved);

    if (resolved) {
      void Preferences.set({ key: PREFS_KEY, value: resolved });
      this.#loadItems(resolved);
    }
  }

  async #fetchServerPrefs(): Promise<string | null> {
    const headers = await firstValueFrom(this.#authService.getRequestHeaders());
    if (!headers.get('Authorization')) return null;
    return firstValueFrom(
      this.#http
        .get<{ currentVocabularyListId: string | null }>('/api/v1/user-preferences', { headers })
        .pipe(
          catchError(() => of({ currentVocabularyListId: null })),
        ),
    ).then((p) => p.currentVocabularyListId);
  }

  #syncServerPrefs(listId: string): void {
    this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        headers.get('Authorization')
          ? this.#http.patch('/api/v1/user-preferences', { currentVocabularyListId: listId }, { headers })
          : EMPTY,
      ),
      catchError(() => EMPTY),
      take(1),
    ).subscribe();
  }

  async #fetchLists(): Promise<VocabularyList[]> {
    const headers = await firstValueFrom(this.#authService.getRequestHeaders());
    if (!headers.get('Authorization')) return [];
    return firstValueFrom(
      this.#http.get<VocabularyList[]>('/api/v1/vocabulary/lists', { headers }).pipe(
        catchError(() => of([])),
      ),
    );
  }

  #loadItems(listId: string): void {
    this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        headers.get('Authorization')
          ? this.#http.get<VocabularyEntry[]>('/api/v1/vocabulary', { headers, params: { listId } })
          : EMPTY,
      ),
      catchError(() => EMPTY),
      take(1),
    ).subscribe((entries) => {
      this.bookmarks.set(entries);
      this.bookmarkedKeys.set(new Set(entries.map((e) => `${e.term}:${e.lang}`)));
    });
  }

  #add(term: string, lang: string): void {
    const listId = this.currentListId()!;
    const key = `${term}:${lang}`;
    const entry: VocabularyEntry = { term, lang, listId, savedAt: new Date().toISOString() };
    const listsSnapshot = this.lists();

    this.bookmarkedKeys.update((s) => new Set([...s, key]));
    this.bookmarks.update((bs) => [entry, ...bs]);
    this.lists.update((ls) => ls.map((l) => (l.id === listId ? { ...l, count: l.count + 1 } : l)));

    this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        headers.get('Authorization')
          ? this.#http.post('/api/v1/vocabulary', { term, lang, listId }, { headers })
          : EMPTY,
      ),
      catchError(() => {
        this.bookmarkedKeys.update((s) => { const n = new Set(s); n.delete(key); return n; });
        this.bookmarks.update((bs) => bs.filter((b) => !(b.term === term && b.lang === lang)));
        this.lists.set(listsSnapshot);
        return EMPTY;
      }),
      take(1),
    ).subscribe();
  }

  #remove(term: string, lang: string): void {
    const listId = this.currentListId()!;
    const key = `${term}:${lang}`;
    const bookmarksSnapshot = this.bookmarks();
    const listsSnapshot = this.lists();

    this.bookmarkedKeys.update((s) => { const n = new Set(s); n.delete(key); return n; });
    this.bookmarks.update((bs) => bs.filter((b) => !(b.term === term && b.lang === lang)));
    this.lists.update((ls) => ls.map((l) => (l.id === listId ? { ...l, count: Math.max(0, l.count - 1) } : l)));

    this.#authService.getRequestHeaders().pipe(
      switchMap((headers) =>
        headers.get('Authorization')
          ? this.#http.delete('/api/v1/vocabulary', { headers, params: { term, lang, listId } })
          : EMPTY,
      ),
      catchError(() => {
        this.bookmarkedKeys.update((s) => new Set([...s, key]));
        this.bookmarks.set(bookmarksSnapshot);
        this.lists.set(listsSnapshot);
        return EMPTY;
      }),
      take(1),
    ).subscribe();
  }
}
