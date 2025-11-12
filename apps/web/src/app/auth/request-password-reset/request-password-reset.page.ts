import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonRow,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
  LoadingController,
} from '@ionic/angular/standalone';

import { TranslateService } from '@ngx-translate/core';

import { finalize } from 'rxjs';
import { BackButtonComponent } from '../../shared/back-button/back-button.component';
import { SharedModule } from '../../shared/shared.module';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-request-password-reset',
  standalone: true,
  imports: [
    FormsModule,
    SharedModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonList,
    IonItem,
    IonInput,
    IonButton,
    IonToast,
  ],
  templateUrl: './request-password-reset.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestPasswordResetPage {
  #loadingCtrl = inject(LoadingController);
  #alertCtrl = inject(AlertController);
  #translate = inject(TranslateService);
  #authService = inject(AuthService);

  isToastOpen = signal(false);

  async onSubmit(form: NgForm) {
    if (!form.valid) {
      return;
    }

    const { email } = form.value;
    const loadingEl = await this.#loadingCtrl.create({
      keyboardClose: true,
      message: this.#translate.instant('auth.sending'),
    });
    loadingEl.present();

    this.#authService
      .requestPasswordReset(email)
      .pipe(
        finalize(() => {
          loadingEl.dismiss();
        })
      )
      .subscribe({
        next: () => {
          form.reset();
          this.isToastOpen.set(true);
        },
        error: (errResp) => {
          if (errResp.error.message === 'EMAIL_NOT_FOUND') {
            this.showAlert(this.#translate.instant('auth.email-not-found'));
          } else {
            this.showAlert(
              this.#translate.instant('common.something-went-wrong')
            );
          }
        },
      });
  }

  private showAlert(message: string) {
    this.#alertCtrl
      .create({
        header: this.#translate.instant('auth.password-reset'),
        message,
        buttons: [this.#translate.instant('common.close')],
      })
      .then((alertEl) => {
        alertEl.present();
      });
  }
}
