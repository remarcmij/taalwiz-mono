import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, helpCircleOutline } from 'ionicons/icons';

import { AuthService } from '../../auth/auth.service';
import { versionInfo } from '../../../environments/version';

@Component({
  selector: 'app-about-modal',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    TranslatePipe,
  ],
  templateUrl: './about-modal.component.html',
  styleUrl: './about-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutModalComponent {
  #modalCtrl = inject(ModalController);
  #router = inject(Router);
  #authService = inject(AuthService);

  protected readonly info = versionInfo;

  constructor() {
    addIcons({ closeOutline, helpCircleOutline });
  }

  dismiss(): void {
    void this.#modalCtrl.dismiss();
  }

  async openGuide(): Promise<void> {
    const lang = this.#authService.user()?.lang ?? 'en';
    await this.#modalCtrl.dismiss();
    void this.#router.navigateByUrl(`/help/${lang}`);
  }
}
