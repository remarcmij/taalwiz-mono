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
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { StudyService } from '../home/study/study.service';
import { ApiErrorAlertService } from '../shared/api-error-alert.service';
import { AppLanguage, LanguageService } from '../shared/i18n/language.service';
import { ThemeMode, ThemeService } from '../shared/theme/theme.service';
import { UserPreferencesService } from '../shared/user-preferences.service';

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
    IonSelect,
    IonSelectOption,
    TranslatePipe,
  ],
})
export class SettingsPage {
  protected themeService = inject(ThemeService);
  protected languageService = inject(LanguageService);
  protected userPreferencesService = inject(UserPreferencesService);
  readonly #studyService = inject(StudyService);
  readonly #apiErrorAlert = inject(ApiErrorAlertService);

  protected readonly newCardOptions = [5, 10, 20, 30, 50];

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

  protected async onNewCardsPerDayChange(value: number): Promise<void> {
    if (value === this.userPreferencesService.newCardsPerDay()) return;
    try {
      await this.userPreferencesService.setNewCardsPerDay(value);
      // Refresh study stats so the vocabulary badge reflects the new cap.
      await this.#studyService.refreshStats();
    } catch (err) {
      await this.#apiErrorAlert.showNetworkError(err as Error);
    }
  }
}
