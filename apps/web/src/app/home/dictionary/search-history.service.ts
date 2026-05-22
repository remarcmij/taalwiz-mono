import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export interface HistoryEntry {
  word: string;
  lang: string;
  searchedAt: string;
}

const PREFS_KEY = 'taalwiz.search-history';
const MAX_HISTORY = 50;

@Injectable({ providedIn: 'root' })
export class SearchHistoryService {
  readonly history = signal<HistoryEntry[]>([]);

  constructor() {
    void this.#loadFromPreferences();
  }

  add(word: string, lang: string): void {
    const entry: HistoryEntry = { word, lang, searchedAt: new Date().toISOString() };
    const filtered = this.history().filter((e) => !(e.word === word && e.lang === lang));
    const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
    this.history.set(updated);
    this.#save(updated);
  }

  async clear(): Promise<void> {
    this.history.set([]);
    await Preferences.remove({ key: PREFS_KEY });
  }

  async #loadFromPreferences(): Promise<void> {
    const { value } = await Preferences.get({ key: PREFS_KEY });
    if (value) {
      try {
        this.history.set(JSON.parse(value) as HistoryEntry[]);
      } catch {
        // corrupted data — start fresh
      }
    }
  }

  #save(entries: HistoryEntry[]): void {
    void Preferences.set({ key: PREFS_KEY, value: JSON.stringify(entries) });
  }
}
