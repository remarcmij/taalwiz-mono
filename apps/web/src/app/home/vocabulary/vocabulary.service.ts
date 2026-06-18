import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, finalize, firstValueFrom, map, of } from 'rxjs';
import { langConfig } from '../../app.constants';
import { AuthService } from '../../auth/auth.service';
import { StudyService } from '../study/study.service';

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
  isPublic: boolean;
  isLocked: boolean;
}

export interface PublicVocabularyList {
  id: string;
  name: string;
  ownerName: string;
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
  #toastCtrl = inject(ToastController);
  #translate = inject(TranslateService);

  readonly bookmarks = signal<VocabularyEntry[]>([]);
  // True while a list's items are being fetched, so the page can show a spinner
  // rather than briefly flashing the "no items" empty state before a large list
  // arrives.
  readonly bookmarksLoading = signal(false);
  readonly bookmarkedKeys = signal<Set<string>>(new Set());
  readonly lists = signal<VocabularyList[]>([]);
  readonly currentListId = signal<string | null>(null);
  readonly currentList = computed(
    () => this.lists().find((l) => l.id === this.currentListId()) ?? null,
  );
  readonly currentListLocked = computed(() => this.currentList()?.isLocked ?? false);
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
        this.bookmarksLoading.set(false);
      }
    });
  }

  isBookmarked(term: string, lang: string): boolean {
    return this.bookmarkedKeys().has(`${term}:${lang}`);
  }

  toggle(term: string, lang: string): void {
    if (!this.currentListId()) return;
    // A locked list is read-only: explain via a toast rather than silently
    // doing nothing or flashing the change and reverting on the server's 409.
    if (this.currentListLocked()) {
      void this.#showLockedToast();
      return;
    }
    if (this.isBookmarked(term, lang)) {
      this.#remove(term, lang);
    } else {
      this.#add(term, lang);
    }
  }

  async #showLockedToast(): Promise<void> {
    const toast = await this.#toastCtrl.create({
      message: this.#translate.instant('vocabulary.list-locked', {
        name: this.currentList()?.name ?? '',
      }),
      duration: 2500,
      position: 'bottom',
      color: 'medium',
    });
    await toast.present();
  }

  /** Offer a one-tap undo after a bookmark is removed (the accident-prone action).
   * The originating `listId` is captured so undo restores the card to that list
   * even if the user has switched lists in the meantime. */
  async #showRemovedToast(term: string, back: string | undefined, listId: string): Promise<void> {
    const toast = await this.#toastCtrl.create({
      message: this.#translate.instant('vocabulary.bookmark-removed', {
        name: this.currentList()?.name ?? '',
      }),
      duration: 4000,
      position: 'bottom',
      buttons: [
        {
          text: this.#translate.instant('common.undo'),
          handler: () => this.addEntry(term, back, listId),
        },
      ],
    });
    await toast.present();
  }

  /** Lock or unlock a list (content becomes immutable; SRS review is unaffected). */
  setListLocked(id: string, isLocked: boolean): void {
    const snapshot = this.lists();
    this.lists.update((ls) => ls.map((l) => (l.id === id ? { ...l, isLocked } : l)));

    this.#http
      .patch(`/api/v1/vocabulary/lists/${id}`, { isLocked })
      .pipe(
        catchError(() => {
          this.lists.set(snapshot);
          return EMPTY;
        }),
      )
      .subscribe();
  }

  /**
   * Add (or restore) an entry. `targetListId` defaults to the current list but is
   * passed explicitly by the remove-undo path so the card returns to the list it
   * came from even if the user has since switched lists.
   */
  addEntry(term: string, back?: string, targetListId?: string): void {
    const listId = targetListId ?? this.currentListId();
    if (!listId) return;
    const lang = langConfig.targetLang;
    const isCurrent = listId === this.currentListId();

    // Adding a term already in the current list must not insert a second row:
    // the list tracks by `term:lang`, so a duplicate key breaks rendering. Update
    // the back instead (only when one was supplied, so an existing definition is
    // not wiped). A non-current target is an undo of a just-removed card, so no
    // duplicate is possible there.
    if (isCurrent && this.isBookmarked(term, lang)) {
      if (back) this.updateBack(term, lang, back);
      return;
    }

    const key = `${term}:${lang}`;
    const entry: VocabularyEntry = { term, lang, listId, back, savedAt: new Date().toISOString() };
    const listsSnapshot = this.lists();
    const bookmarksSnapshot = this.bookmarks();
    const keysSnapshot = this.bookmarkedKeys();

    // Only touch the visible list/keys when adding to the list on screen.
    if (isCurrent) {
      this.bookmarkedKeys.update((s) => new Set([...s, key]));
      this.bookmarks.update((bs) => [entry, ...bs]);
    }
    this.lists.update((ls) => ls.map((l) => (l.id === listId ? { ...l, count: l.count + 1 } : l)));

    this.#http
      .post('/api/v1/vocabulary', { items: [{ term, lang, listId, back }] })
      .pipe(
        catchError(() => {
          if (isCurrent) {
            this.bookmarkedKeys.set(keysSnapshot);
            this.bookmarks.set(bookmarksSnapshot);
          }
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

  setListPublic(id: string, isPublic: boolean): void {
    const snapshot = this.lists();
    this.lists.update((ls) => ls.map((l) => (l.id === id ? { ...l, isPublic } : l)));

    this.#http
      .patch(`/api/v1/vocabulary/lists/${id}`, { isPublic })
      .pipe(
        catchError(() => {
          this.lists.set(snapshot);
          return EMPTY;
        }),
      )
      .subscribe();
  }

  async fetchPublicLists(): Promise<PublicVocabularyList[]> {
    return firstValueFrom(
      this.#http
        .get<PublicVocabularyList[]>('/api/v1/vocabulary/public')
        .pipe(catchError(() => of([]))),
    );
  }

  async fetchPublicItems(listId: string): Promise<VocabularyEntry[]> {
    return firstValueFrom(
      this.#http
        .get<VocabularyEntry[]>(`/api/v1/vocabulary/public/${listId}/items`)
        .pipe(catchError(() => of([]))),
    );
  }

  /** Clone a public list into the user's own account, then switch to it. Returns the new list. */
  async cloneList(publicListId: string): Promise<VocabularyList | null> {
    const list = await firstValueFrom(
      this.#http
        .post<VocabularyList>(`/api/v1/vocabulary/public/${publicListId}/clone`, {})
        .pipe(catchError(() => of(null))),
    );
    if (!list) return null;
    this.lists.update((ls) => [...ls, list]);
    this.setCurrentList(list.id);
    void this.#studyService.refreshStats();
    return list;
  }

  async #initLists(): Promise<void> {
    // Mark loading up front: there are awaits before #loadItems runs, and without
    // this the empty state would flash between `lists` being set and the items
    // arriving.
    this.bookmarksLoading.set(true);
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
    } else {
      this.bookmarksLoading.set(false); // no list to load items for
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
    this.bookmarksLoading.set(true);
    this.#http
      .get<VocabularyEntry[]>('/api/v1/vocabulary', { params: { listId } })
      .pipe(
        catchError(() => EMPTY),
        finalize(() => this.bookmarksLoading.set(false)),
      )
      .subscribe((entries) => {
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

    this.#http
      .post('/api/v1/vocabulary', { items: [{ term, lang, listId }] })
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
    const removedBack = bookmarksSnapshot.find((b) => b.term === term && b.lang === lang)?.back;
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
      .subscribe(() => {
        void this.#studyService.refreshStats();
        void this.#showRemovedToast(term, removedBack, listId);
      });
  }
}
