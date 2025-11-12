import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { catchError, tap } from 'rxjs';

import { ApiErrorAlertService } from '../../shared/api-error-alert.service';
import { BackButtonComponent } from '../../shared/back-button/back-button.component';
import { LoggerService } from '../../shared/logger.service';
import { AdminService } from '../admin.service';
import { ISystemSettings } from './system-settings.model';

function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function deepEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

@Component({
  selector: 'app-system-settings',
  standalone: true,
  imports: [
    FormsModule,
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonToggle,
    IonDatetime,
  ],
  templateUrl: './system-settings.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SystemSettingsPage implements OnInit, OnDestroy {
  #adminService = inject(AdminService);
  #logger = inject(LoggerService);
  #apiErrorAlertService = inject(ApiErrorAlertService);

  settings = signal<ISystemSettings[]>([]);

  #origSettings: ISystemSettings[] = [];

  ngOnInit() {
    this.#adminService.getSettings().subscribe((settings) => {
      this.settings.set(settings);
      this.#origSettings = deepCopy(settings);
    });
  }

  checkIfDirty() {
    return !deepEqual(this.settings(), this.#origSettings);
  }

  ngOnDestroy(): void {
    if (!this.checkIfDirty()) {
      return;
    }

    this.#adminService
      .updateSettings(this.settings())
      .pipe(
        tap(() => {
          this.#logger.debug('Settings updated');
        }),
        catchError((error) => this.#apiErrorAlertService.showError(error)),
      )
      .subscribe();
  }
}
