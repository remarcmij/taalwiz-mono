import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  IonSpinner,
  IonTitle,
  IonToolbar,
  LoadingController,
} from '@ionic/angular/standalone';

import { TranslateService } from '@ngx-translate/core';

import { finalize } from 'rxjs';
import { MIN_PASSWORD_LENGTH } from '../../server/shared/shared';
import { SharedModule } from '../../shared/shared.module';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    FormsModule,
    SharedModule,
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
    IonInputPasswordToggle,
    IonButton,
  ],
  templateUrl: './reset-password.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  #route = inject(ActivatedRoute);
  #router = inject(Router);
  #loadingCtrl = inject(LoadingController);
  #translate = inject(TranslateService);
  #alertCtrl = inject(AlertController);
  #authService = inject(AuthService);

  email = signal('');
  password = signal('');
  minLength = MIN_PASSWORD_LENGTH;

  #token = '';

  constructor() {
    this.email.set(this.#route.snapshot.queryParams['email']);
    this.#token = this.#route.snapshot.queryParams['token'];
  }

  onSubmit(form: NgForm) {
    if (!form.valid) {
      return;
    }

    const { password } = form.value;
    this.resetPassword(password);
  }

  private async resetPassword(password: string) {
    const loadingEl = await this.#loadingCtrl.create({
      keyboardClose: true,
      message: this.#translate.instant('auth.sending'),
    });
    loadingEl.present();

    this.#authService
      .resetPassword(password, this.#token)
      .pipe(
        finalize(() => {
          loadingEl.dismiss();
        })
      )
      .subscribe({
        next: async () => {
          const alertEl = await this.#alertCtrl.create({
            header: this.#translate.instant('auth.password-reset'),
            message: this.#translate.instant('auth.password-reset-success'),
            buttons: [
              {
                text: this.#translate.instant('common.close'),
                handler: () => {
                  this.#router.navigateByUrl('/auth', { replaceUrl: true });
                },
              },
            ],
          });
          alertEl.present();
          await alertEl.onDidDismiss();
          this.#router.navigateByUrl('/auth', { replaceUrl: true });
        },
        error: (errResp) => {
          this.#alertCtrl
            .create({
              header: 'Error',
              message: errResp.error.message,
              buttons: ['Okay'],
            })
            .then((alertEl) => alertEl.present());
        },
      });
  }
}
