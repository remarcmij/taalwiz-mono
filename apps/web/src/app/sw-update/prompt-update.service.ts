import { ApplicationRef, inject, Injectable, signal } from '@angular/core';
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

  #updateReady = signal(false);
  readonly updateReady = this.#updateReady.asReadonly();

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
        this.#updateReady.set(true);
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
        this.applyUpdate();
      });
  }

  applyUpdate(): void {
    // sessionStorage flag is read by AppComponent after the reload to surface
    // a confirmation toast — without it, the reload is silent and the user has
    // no signal that the install succeeded.
    sessionStorage.setItem(UPDATE_INSTALLED_FLAG, '1');
    document.location.reload();
  }
}

export const UPDATE_INSTALLED_FLAG = 'sw.updateInstalled';
