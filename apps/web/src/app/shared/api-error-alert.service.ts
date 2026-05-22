import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class ApiErrorAlertService {
  #alertCtrl = inject(AlertController);
  #translate = inject(TranslateService);

  async showError(error: Error) {
    const alert = await this.#alertCtrl.create({
      header: this.#translate.instant('common.server-error'),
      message: error.message,
      buttons: [this.#translate.instant('common.close')],
    });

    await alert.present();
  }

  async showNetworkError(error: Error): Promise<void> {
    const isOffline =
      (error instanceof HttpErrorResponse && (error.status === 504 || error.status === 0)) ||
      !navigator.onLine;

    const header = isOffline
      ? this.#translate.instant('common.offline-header')
      : this.#translate.instant('common.network-error-header');
    const message = isOffline
      ? this.#translate.instant('common.offline-message')
      : this.#translate.instant('common.network-error-message');

    const alert = await this.#alertCtrl.create({
      header,
      message,
      buttons: [this.#translate.instant('common.close')],
    });

    await alert.present();
  }
}
