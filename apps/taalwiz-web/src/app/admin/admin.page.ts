import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
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
  settingsOutline,
} from 'ionicons/icons';

import { BackButtonComponent } from '../shared/back-button/back-button.component';

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
  constructor() {
    addIcons({
      personAddOutline,
      libraryOutline,
      peopleOutline,
      cloudUploadOutline,
      settingsOutline,
    });
  }
}
