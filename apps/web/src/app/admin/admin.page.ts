import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRouterLink,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  cloudUploadOutline,
  libraryOutline,
  peopleOutline,
  personAddOutline,
  refreshOutline,
  settingsOutline,
} from 'ionicons/icons';

import { BackButtonComponent } from '../shared/back-button/back-button.component';
import { AdminService } from './admin.service';

@Component({
  selector: 'app-admin',
  imports: [
    RouterLink,
    BackButtonComponent,
    IonRouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonIcon,
    IonLabel,
  ],
  templateUrl: './admin.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPage {
  #adminService = inject(AdminService);
  #alertCtrl = inject(AlertController);

  constructor() {
    addIcons({
      personAddOutline,
      libraryOutline,
      peopleOutline,
      cloudUploadOutline,
      refreshOutline,
      settingsOutline,
    });
  }

  async reprocessHashtags() {
    this.#adminService.reprocessHashtags().subscribe({
      next: async () => {
        const alert = await this.#alertCtrl.create({
          header: 'Done',
          message: 'Hashtags reprocessed successfully.',
          buttons: ['OK'],
        });
        await alert.present();
      },
      error: async (err) => {
        const alert = await this.#alertCtrl.create({
          header: 'Error',
          message: err?.error?.message ?? 'Reprocess failed.',
          buttons: ['OK'],
        });
        await alert.present();
      },
    });
  }
}
