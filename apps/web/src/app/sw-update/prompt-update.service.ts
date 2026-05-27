import { ApplicationRef, inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { concat, filter, first, interval } from 'rxjs';

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PromptUpdateService {
  #alertCtrl = inject(AlertController);
  #translate = inject(TranslateService);
  #appRef = inject(ApplicationRef);

  constructor(swUpdate: SwUpdate) {
    if (!swUpdate.isEnabled) {
      return;
    }

    // A page reload alone does not make the running service worker re-read
    // ngsw.json, so update detection is unreliable without an explicit check.
    // Check once the app first stabilizes, then on a fixed interval, so warm
    // reloads and long-lived tabs both pick up new versions.
    const appIsStable$ = this.#appRef.isStable.pipe(first((isStable) => isStable === true));
    concat(appIsStable$, interval(UPDATE_CHECK_INTERVAL_MS)).subscribe(() => {
      void swUpdate.checkForUpdate().catch(() => undefined);
    });

    swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(async (_evt) => {
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
