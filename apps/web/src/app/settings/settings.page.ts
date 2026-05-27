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

  protected onThemeChange(value: ThemeMode): void {
    void this.themeService.setTheme(value);
  }
}
