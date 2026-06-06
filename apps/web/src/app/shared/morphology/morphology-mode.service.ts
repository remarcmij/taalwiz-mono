import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Global Show <-> Quiz mode for the word-modal affix breakdown.
 *
 * - 'show'  : the breakdown is rendered directly (the passive aid, default).
 * - 'quiz'  : the breakdown is hidden behind a tap-to-reveal prompt, so the learner
 *             can try to decompose the word themselves first, then self-grade.
 *
 * The choice is persisted (Capacitor Preferences reads/writes localStorage on web, so
 * the round-trip is effectively instant) and exposed as a signal, so every word modal
 * shares one reactive source of truth. Mirrors ThemeService.
 */
const PREFS_KEY = 'app.morphologyQuiz';

@Injectable({ providedIn: 'root' })
export class MorphologyModeService {
  readonly quizMode = signal<boolean>(false);

  constructor() {
    void this.#load();
  }

  async toggle(): Promise<void> {
    const next = !this.quizMode();
    this.quizMode.set(next);
    await Preferences.set({ key: PREFS_KEY, value: String(next) });
  }

  async #load(): Promise<void> {
    const { value } = await Preferences.get({ key: PREFS_KEY });
    this.quizMode.set(value === 'true');
  }
}
