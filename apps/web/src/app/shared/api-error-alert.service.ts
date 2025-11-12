import { inject, Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class ApiErrorAlertService {
  #alertCtrl = inject(AlertController);
  #translate = inject(TranslateService);

  async showError(error: any) {
    const alert = await this.#alertCtrl.create({
      header: this.#translate.instant('common.server-error'),
      message: error.message,
      buttons: [this.#translate.instant('common.close')],
    });

    await alert.present();
  }
}
