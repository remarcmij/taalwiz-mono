import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonList,
  IonRow,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { first, switchMap } from 'rxjs';

import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { homeUrl } from '../../home/home.routes';
import {
  AUTH_FAILED,
  DEMO_ACCOUNT,
  EMAIL_NOT_FOUND,
  MIN_PASSWORD_LENGTH,
} from '../../server/shared/shared';
import { BackButtonComponent } from '../../shared/back-button/back-button.component';
import { LoggerService } from '../../shared/logger.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-change-password',
  imports: [
    FormsModule,
    TranslateModule,
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonList,
    IonItem,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonSpinner,
  ],
  templateUrl: './change-password.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordPage {
  #alertCtrl = inject(AlertController);
  #authService = inject(AuthService);
  #router = inject(Router);
  #translate = inject(TranslateService);
  #logger = inject(LoggerService);
  #http = inject(HttpClient);

  isLoading = signal(false);
  password = signal('');
  newPassword = signal('');
  minLength = MIN_PASSWORD_LENGTH;

  onSubmit(form: NgForm) {
    if (!form.valid) {
      return;
    }

    const { password, newPassword } = form.value;

    this.#authService.user$
      .pipe(
        first(),
        switchMap((user) => {
          if (!user) {
            this.#logger.debug('ChangePasswordPage', 'No user found');
            throw new Error('User not found');
          }
          return this.#http.post('/api/v1/users/change-password', {
            email: user.email,
            password,
            newPassword,
          });
        }),
      )
      .subscribe({
        next: async (resData) => {
          this.#logger.debug('ChangePasswordPage', resData);
          const alertEl = await this.#alertCtrl.create({
            header: this.#translate.instant('auth.password-changed'),
            message: this.#translate.instant('auth.password-change-success'),
            buttons: [this.#translate.instant('common.close')],
          });
          await alertEl.present();
          await alertEl.onDidDismiss();
          form.reset();
          this.#router.navigateByUrl(homeUrl, { replaceUrl: true });
        },
        error: (errResp) => {
          this.#logger.error('ChangePasswordPage', errResp.error.message);
          let messageKey: string;
          switch (errResp.error.message) {
            case AUTH_FAILED:
              messageKey = 'auth.password-change-wrong-current';
              break;
            case DEMO_ACCOUNT:
              messageKey = 'auth.demo-account-no-password-change';
              break;
            case EMAIL_NOT_FOUND:
              messageKey = 'auth.email-not-found';
              break;
            default:
              messageKey = 'auth.password-change-failed';
          }
          this.#alertCtrl
            .create({
              header: this.#translate.instant('auth.password-change-error'),
              message: this.#translate.instant(messageKey),
              buttons: [this.#translate.instant('common.close')],
            })
            .then((alertEl) => alertEl.present());
        },
      });
  }
}
