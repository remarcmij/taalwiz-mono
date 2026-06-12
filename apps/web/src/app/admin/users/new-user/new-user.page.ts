import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonRadio,
  IonRadioGroup,
  IonRow,
  IonText,
  IonTitle,
  IonToolbar,
  AlertController,
  LoadingController,
  NavController,
} from '@ionic/angular/standalone';

import { TranslatePipe } from '@ngx-translate/core';
import { EMAIL_EXISTS } from '@repo/shared';
import { ApiErrorAlertService } from '../../../shared/api-error-alert.service';
import { BackButtonComponent } from '../../../shared/back-button/back-button.component';
import { LoggerService } from '../../../shared/logger.service';
import { AdminService } from '../../admin.service';

const DEFAULT_LANG = 'nl';

@Component({
  selector: 'app-new-user',
  imports: [
    FormsModule,
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonText,
    IonList,
    IonListHeader,
    IonLabel,
    IonItem,
    IonInput,
    IonRadioGroup,
    IonRadio,
    IonButton,
    TranslatePipe,
  ],
  templateUrl: './new-user.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewUserPage {
  #loadingCtrl = inject(LoadingController);
  #alertCtrl = inject(AlertController);
  #navCtrl = inject(NavController);
  #adminService = inject(AdminService);
  #apiErrorAlertService = inject(ApiErrorAlertService);
  #logger = inject(LoggerService);

  lang = signal(DEFAULT_LANG);

  async onSubmit(form: NgForm) {
    if (!form.valid) {
      return;
    }

    const { email } = form.value;

    const loadingEl = await this.#loadingCtrl.create({
      keyboardClose: true,
      message: 'Sending invitation...',
    });
    loadingEl.present();

    this.#adminService.inviteNewUser(email, this.lang()).subscribe({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      next: async (info: any) => {
        loadingEl.dismiss();
        const accepted = info.accepted.join(', ');
        this.#logger.debug('NewUserPage', accepted);
        // Acknowledge with an alert and only navigate back once the admin has
        // dismissed it, so the confirmation is always read; a toast would be
        // torn down by the immediate route transition.
        const alert = await this.#alertCtrl.create({
          header: 'Invitation Sent',
          message: `An invitation email has been sent successfully to ${accepted}.`,
          buttons: ['OK'],
        });
        await alert.present();
        await alert.onDidDismiss();
        this.#navCtrl.back();
      },
      error: async ({ error }) => {
        loadingEl.dismiss();
        this.#logger.error('NewUserPage', error.message);
        let message = 'An error occurred while sending the invitation.';
        if (error.message === EMAIL_EXISTS) {
          message = 'The email address is already registered.';
        }
        this.#apiErrorAlertService.showError(new Error(message));
      },
    });
  }
}
