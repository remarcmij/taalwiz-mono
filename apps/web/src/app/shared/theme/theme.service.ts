import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export type ThemeMode = 'system' | 'light' | 'dark';

const PREFS_KEY = 'app.theme';
const VALID_MODES: ThemeMode[] = ['system', 'light', 'dark'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<ThemeMode>('light');

  readonly #mql = window.matchMedia('(prefers-color-scheme: dark)');
  #mqlListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    // Load the saved preference and apply it. Capacitor Preferences on web
    // reads from localStorage so the round-trip is practically instantaneous.
    void this.#loadAndApply();
  }

  async setTheme(mode: ThemeMode): Promise<void> {
    await Preferences.set({ key: PREFS_KEY, value: mode });
    this.theme.set(mode);
    this.#apply(mode);
  }

  async #loadAndApply(): Promise<void> {
    const { value } = await Preferences.get({ key: PREFS_KEY });
    const saved: ThemeMode = VALID_MODES.includes(value as ThemeMode)
      ? (value as ThemeMode)
      : 'light';
    this.theme.set(saved);
    this.#apply(saved);
  }

  #apply(mode: ThemeMode): void {
    // Remove any existing OS-preference listener before switching modes.
    if (this.#mqlListener) {
      this.#mql.removeEventListener('change', this.#mqlListener);
      this.#mqlListener = null;
    }

    if (mode === 'dark') {
      document.documentElement.classList.add('ion-palette-dark');
    } else if (mode === 'light') {
      document.documentElement.classList.remove('ion-palette-dark');
    } else {
      // 'system': mirror the OS preference and watch for changes.
      const sync = (dark: boolean) =>
        document.documentElement.classList.toggle('ion-palette-dark', dark);
      sync(this.#mql.matches);
      this.#mqlListener = (e) => sync(e.matches);
      this.#mql.addEventListener('change', this.#mqlListener);
    }
  }
}
