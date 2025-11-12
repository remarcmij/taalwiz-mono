import { inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PromptUpdateService {
  #alertCtrl = inject(AlertController);
  #translate = inject(TranslateService);


  constructor(swUpdate: SwUpdate) {
    if (!swUpdate.isEnabled) {
      return;
    }

    swUpdate.versionUpdates
      .pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
      )
      .subscribe(async (evt) => {
        const alertEl = await this.#alertCtrl.create({
          header: this.#translate.instant('update.update-available'),
          message: this.#translate.instant('update.update-message'),
          buttons: [
            { text: 'OK', role: 'confirm' },
            {
              text: this.#translate.instant('update.update-later'),
              role: 'cancel',
            },
          ],
        });
        await alertEl.present();
        const data = await alertEl.onDidDismiss();
        if (data.role === 'cancel') {
          return;
        }
        // Reload the page to update to the latest version.
        document.location.reload();
      });
  }
}
