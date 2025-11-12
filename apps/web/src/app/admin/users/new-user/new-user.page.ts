import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
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
  IonToast,
  IonToolbar,
  LoadingController,
} from '@ionic/angular/standalone';

import { EMAIL_EXISTS } from '../../../server/shared/shared';
import { ApiErrorAlertService } from '../../../shared/api-error-alert.service';
import { BackButtonComponent } from '../../../shared/back-button/back-button.component';
import { LoggerService } from '../../../shared/logger.service';
import { SharedModule } from '../../../shared/shared.module';
import { AdminService } from '../../admin.service';

const DEFAULT_LANG = 'nl';

@Component({
  selector: 'app-new-user',
  standalone: true,
  imports: [
    FormsModule,
    SharedModule,
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
    IonToast,
  ],
  templateUrl: './new-user.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewUserPage {
  #loadingCtrl = inject(LoadingController);
  #adminService = inject(AdminService);
  #apiErrorAlertService = inject(ApiErrorAlertService);
  #logger = inject(LoggerService);

  isToastOpen = signal(false);
  acceptedEmails = signal('???');
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

    this.#adminService.sendRegistrationRequest(email, this.lang()).subscribe({
      next: (info: any) => {
        this.acceptedEmails.set(info.accepted.join(', '));
        loadingEl.dismiss();
        this.isToastOpen.set(true);
        this.#logger.debug('NewUserPage', this.acceptedEmails);
      },
      error: async ({ error }) => {
        loadingEl.dismiss();
        this.#logger.error('NewUserPage', error.message);
        let message = 'An error occurred while sending the invitation.';
        if (error.message === EMAIL_EXISTS) {
          message = 'The email address is already registered.';
        }
        this.#apiErrorAlertService.showError(error);
      },
    });
  }
}
