import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { EMPTY, catchError, firstValueFrom, map, of } from 'rxjs';
import { langConfig } from '../../app.constants';
import { AuthService } from '../../auth/auth.service';
import { StudyService } from '../study/study.service';

export interface VocabularyEntry {
  term: string;
  lang: string;
  listId: string;
  back?: string;
  sourceSentence?: string;
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
  #studyService = inject(StudyService);

  readonly bookmarks = signal<VocabularyEntry[]>([]);
  readonly bookmarkedKeys = signal<Set<string>>(new Set());
  readonly lists = signal<VocabularyList[]>([]);
  readonly currentListId = signal<string | null>(null);
  readonly currentList = computed(
    () => this.lists().find((l) => l.id === this.currentListId()) ?? null,
  );
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

  toggle(term: string, lang: string, sourceSentence?: string): void {
    if (!this.currentListId()) return;
    if (this.isBookmarked(term, lang)) {
      this.#remove(term, lang);
    } else {
      this.#add(term, lang, sourceSentence);
    }
  }

  addEntry(term: string, back?: string): void {
    if (!this.currentListId()) return;
    const listId = this.currentListId()!;
    const lang = langConfig.targetLang;
    const key = `${term}:${lang}`;
    const entry: VocabularyEntry = { term, lang, listId, back, savedAt: new Date().toISOString() };
    const listsSnapshot = this.lists();

    this.bookmarkedKeys.update((s) => new Set([...s, key]));
    this.bookmarks.update((bs) => [entry, ...bs]);
    this.lists.update((ls) => ls.map((l) => (l.id === listId ? { ...l, count: l.count + 1 } : l)));

    this.#http
      .post('/api/v1/vocabulary', { items: [{ term, lang, listId, back }] })
      .pipe(
        catchError(() => {
          this.bookmarkedKeys.update((s) => {
            const n = new Set(s);
            n.delete(key);
            return n;
          });
          this.bookmarks.update((bs) => bs.filter((b) => !(b.term === term && b.lang === lang)));
          this.lists.set(listsSnapshot);
          return EMPTY;
        }),
      )
      .subscribe(() => void this.#studyService.refreshStats());
  }

  updateBack(term: string, lang: string, back: string): void {
    if (!this.currentListId()) return;
    const listId = this.currentListId()!;
    const snapshot = this.bookmarks();

    this.bookmarks.update((bs) =>
      bs.map((b) => (b.term === term && b.lang === lang ? { ...b, back: back || undefined } : b)),
    );

    this.#http
      .post('/api/v1/vocabulary', { items: [{ term, lang, listId, back }] })
      .pipe(
        catchError(() => {
          this.bookmarks.set(snapshot);
          return EMPTY;
        }),
      )
      .subscribe();
  }

  async addEntries(entries: { term: string; back?: string }[]): Promise<number> {
    const listId = this.currentListId();
    if (!listId) return 0;
    const lang = langConfig.targetLang;

    const items = entries.map(({ term, back }) => ({ term, lang, listId, back }));
    const succeeded = await firstValueFrom(
      this.#http.post('/api/v1/vocabulary', { items }).pipe(
        map(() => entries.length),
        catchError(() => of(0)),
      ),
    );

    this.#loadItems(listId);
    const updatedLists = await this.#fetchLists();
    this.lists.set(updatedLists);
    void this.#studyService.refreshStats();
    return succeeded;
  }

  setCurrentList(id: string): void {
    this.currentListId.set(id);
    void Preferences.set({ key: PREFS_KEY, value: id });
    this.#syncServerPrefs(id);
    this.#loadItems(id);
  }

  createList(name: string): void {
    this.#http
      .post<VocabularyList>('/api/v1/vocabulary/lists', { name })
      .pipe(catchError(() => EMPTY))
      .subscribe((list) => {
        this.lists.update((ls) => [...ls, list]);
        // Creating a list switches to it — users expect the list they just made
        // to become the active one.
        this.setCurrentList(list.id);
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

    this.#http
      .delete(`/api/v1/vocabulary/lists/${id}`)
      .pipe(
        catchError(() => {
          this.lists.set(snapshot);
          return EMPTY;
        }),
      )
      .subscribe();
  }

  renameList(id: string, newName: string): void {
    const snapshot = this.lists();
    this.lists.update((ls) => ls.map((l) => (l.id === id ? { ...l, name: newName } : l)));

    this.#http
      .patch(`/api/v1/vocabulary/lists/${id}`, { name: newName })
      .pipe(
        catchError(() => {
          this.lists.set(snapshot);
          return EMPTY;
        }),
      )
      .subscribe();
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
    return firstValueFrom(
      this.#http
        .get<{ currentVocabularyListId: string | null }>('/api/v1/user-preferences')
        .pipe(catchError(() => of({ currentVocabularyListId: null }))),
    ).then((p) => p.currentVocabularyListId);
  }

  #syncServerPrefs(listId: string): void {
    this.#http
      .patch('/api/v1/user-preferences', { currentVocabularyListId: listId })
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  async #fetchLists(): Promise<VocabularyList[]> {
    return firstValueFrom(
      this.#http.get<VocabularyList[]>('/api/v1/vocabulary/lists').pipe(catchError(() => of([]))),
    );
  }

  #loadItems(listId: string): void {
    this.#http
      .get<VocabularyEntry[]>('/api/v1/vocabulary', { params: { listId } })
      .pipe(catchError(() => EMPTY))
      .subscribe((entries) => {
        this.bookmarks.set(entries);
        this.bookmarkedKeys.set(new Set(entries.map((e) => `${e.term}:${e.lang}`)));
      });
  }

  #add(term: string, lang: string, sourceSentence?: string): void {
    const listId = this.currentListId()!;
    const key = `${term}:${lang}`;
    const entry: VocabularyEntry = { term, lang, listId, sourceSentence, savedAt: new Date().toISOString() };
    const listsSnapshot = this.lists();

    this.bookmarkedKeys.update((s) => new Set([...s, key]));
    this.bookmarks.update((bs) => [entry, ...bs]);
    this.lists.update((ls) => ls.map((l) => (l.id === listId ? { ...l, count: l.count + 1 } : l)));

    this.#http
      .post('/api/v1/vocabulary', { items: [{ term, lang, listId, sourceSentence }] })
      .pipe(
        catchError(() => {
          this.bookmarkedKeys.update((s) => {
            const n = new Set(s);
            n.delete(key);
            return n;
          });
          this.bookmarks.update((bs) => bs.filter((b) => !(b.term === term && b.lang === lang)));
          this.lists.set(listsSnapshot);
          return EMPTY;
        }),
      )
      .subscribe(() => void this.#studyService.refreshStats());
  }

  #remove(term: string, lang: string): void {
    const listId = this.currentListId()!;
    const key = `${term}:${lang}`;
    const bookmarksSnapshot = this.bookmarks();
    const listsSnapshot = this.lists();

    this.bookmarkedKeys.update((s) => {
      const n = new Set(s);
      n.delete(key);
      return n;
    });
    this.bookmarks.update((bs) => bs.filter((b) => !(b.term === term && b.lang === lang)));
    this.lists.update((ls) =>
      ls.map((l) => (l.id === listId ? { ...l, count: Math.max(0, l.count - 1) } : l)),
    );

    this.#http
      .delete('/api/v1/vocabulary', { params: { term, lang, listId } })
      .pipe(
        catchError(() => {
          this.bookmarkedKeys.update((s) => new Set([...s, key]));
          this.bookmarks.set(bookmarksSnapshot);
          this.lists.set(listsSnapshot);
          return EMPTY;
        }),
      )
      .subscribe(() => void this.#studyService.refreshStats());
  }
}
