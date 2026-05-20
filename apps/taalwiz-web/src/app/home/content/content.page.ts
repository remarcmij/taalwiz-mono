import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonThumbnail,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { TranslatePipe } from '@ngx-translate/core';
import { ContentService } from './content.service';

@Component({
  selector: 'app-content',
  imports: [
    AsyncPipe,
    RouterLink,
    TranslatePipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonImg,
    IonItem,
    IonLabel,
    IonList,
    IonMenuButton,
    IonRefresher,
    IonRefresherContent,
    IonThumbnail,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './content.page.html',
  styleUrls: ['./content.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentPage {
  #contentService = inject(ContentService);

  topics$ = this.#contentService.fetchPublications();

  handleRefresh(event?: { target: { complete: () => void } }) {
    this.topics$ = this.#contentService.fetchPublications();
    event?.target.complete();
  }
}
