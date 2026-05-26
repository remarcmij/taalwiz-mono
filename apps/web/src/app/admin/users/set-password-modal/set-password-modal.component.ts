import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonList,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { MIN_PASSWORD_LENGTH } from '@repo/api-types';

@Component({
  selector: 'app-set-password-modal',
  templateUrl: './set-password-modal.component.html',
  styleUrl: './set-password-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonInputPasswordToggle,
  ],
})
export class SetPasswordModalComponent {
  email = input.required<string>();

  newPassword = signal('');
  readonly minLength = MIN_PASSWORD_LENGTH;

  #modalCtrl = new ModalController();

  save() {
    if (this.newPassword().length < this.minLength) return;
    this.#modalCtrl.dismiss({ newPassword: this.newPassword() }, 'save');
  }

  cancel() {
    this.#modalCtrl.dismiss(null, 'cancel');
  }
}
