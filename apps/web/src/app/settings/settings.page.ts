import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRadio,
  IonRadioGroup,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiErrorAlertService } from '../shared/api-error-alert.service';
import { AppLanguage, LanguageService } from '../shared/i18n/language.service';
import { ThemeMode, ThemeService } from '../shared/theme/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonRadioGroup,
    IonRadio,
    TranslatePipe,
  ],
})
export class SettingsPage {
  protected themeService = inject(ThemeService);
  protected languageService = inject(LanguageService);
  readonly #apiErrorAlert = inject(ApiErrorAlertService);

  protected onThemeChange(value: ThemeMode): void {
    void this.themeService.setTheme(value);
  }

  protected async onLanguageChange(value: AppLanguage): Promise<void> {
    if (value === this.languageService.language()) return;
    try {
      await this.languageService.setLanguage(value);
    } catch (err) {
      await this.#apiErrorAlert.showNetworkError(err as Error);
    }
  }
}
