import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../auth/auth.service';

export type AppLanguage = 'nl' | 'en';

const PREFS_KEY = 'app.lang';
const VALID_LANGS: AppLanguage[] = ['nl', 'en'];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly language = signal<AppLanguage>('nl');

  readonly #translate = inject(TranslateService);
  readonly #http = inject(HttpClient);
  readonly #auth = inject(AuthService);

  constructor() {
    // Server is source of truth once the user is logged in: a value coming
    // back from the API overrides the local bootstrap cache.
    this.#auth.user$.subscribe((user) => {
      if (user && VALID_LANGS.includes(user.lang as AppLanguage)) {
        void this.#applyLocal(user.lang as AppLanguage);
      }
    });
  }

  // Loads the cached preference and applies it. Used as an APP_INITIALIZER so
  // pre-login screens render in the user's last-used language.
  async init(): Promise<void> {
    const { value } = await Preferences.get({ key: PREFS_KEY });
    const lang: AppLanguage = VALID_LANGS.includes(value as AppLanguage)
      ? (value as AppLanguage)
      : 'nl';
    await this.#applyLocal(lang);
  }

  async setLanguage(lang: AppLanguage): Promise<void> {
    await firstValueFrom(this.#http.patch('/api/v1/users/me/lang', { lang }));
    await this.#applyLocal(lang);
    this.#auth.applyLangToCurrentUser(lang);
  }

  async #applyLocal(lang: AppLanguage): Promise<void> {
    await Preferences.set({ key: PREFS_KEY, value: lang });
    this.language.set(lang);
    await firstValueFrom(this.#translate.use(lang));
  }
}
