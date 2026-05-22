import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonList,
  IonRow,
  IonTitle,
  IonToolbar,
  LoadingController,
} from '@ionic/angular/standalone';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { finalize } from 'rxjs';
import { homeUrl } from '../home/home.routes';
import { AUTH_FAILED, MIN_PASSWORD_LENGTH } from '../server/shared/shared';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-auth',
  imports: [
    RouterLink,
    FormsModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonList,
    IonItem,
    IonInput,
    IonButton,
    IonInputPasswordToggle,
  ],
  templateUrl: './auth.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage {
  #router = inject(Router);
  #alertCtrl = inject(AlertController);
  #loadingCtrl = inject(LoadingController);
  #authService = inject(AuthService);
  #translate = inject(TranslateService);

  password = signal('');
  minLength = MIN_PASSWORD_LENGTH;

  async onSubmit(form: NgForm) {
    if (!form.valid) {
      return;
    }

    const { email, password } = form.value;

    const loadingEl = await this.#loadingCtrl.create({
      keyboardClose: true,
      message: this.#translate.instant('auth.logging-in'),
    });
    loadingEl.present();

    this.#authService
      .login(email, password)
      .pipe(
        finalize(() => {
          loadingEl.dismiss();
        })
      )
      .subscribe({
        next: () => {
          form.reset();
          this.#router.navigateByUrl(homeUrl, { replaceUrl: true });
        },
        error: (errResp) => {
          const msgKey =
            errResp.error.message === AUTH_FAILED
              ? 'auth.auth-failed'
              : 'auth.login-failed';
          const alertText = this.#translate.instant(msgKey);
          this.showAlert(alertText);
        },
      });
  }

  private showAlert(message: string) {
    this.#alertCtrl
      .create({
        header: this.#translate.instant('auth.login-error'),
        message,
        buttons: [this.#translate.instant('common.close')],
      })
      .then((alertEl) => {
        alertEl.present();
      });
  }
}
