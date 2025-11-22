import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Platform } from '@ionic/angular';
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
  IonText,
  IonThumbnail,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { TranslatePipe } from '@ngx-translate/core';
import { ContentService } from './content.service';

@Component({
  selector: 'app-content',
  imports: [
    IonButton,
    IonText,
    AsyncPipe,
    IonRefresherContent,
    IonRefresher,
    IonHeader,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonThumbnail,
    IonImg,
    IonLabel,
    RouterLink,
    AsyncPipe,
    TranslatePipe,
  ],
  templateUrl: './content.page.html',
  styleUrls: ['./content.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentPage implements OnInit {
  #platform = inject(Platform);
  #contentService = inject(ContentService);

  topics$ = this.#contentService.fetchPublications();

  isDesktop = this.#platform.is('desktop');
  giveUpWaiting = signal(false);

  ngOnInit(): void {
    setTimeout(() => {
      this.giveUpWaiting.set(true);
    }, 1000);
  }

  handleRefresh(event?: { target: { complete: () => void } }) {
    this.topics$ = this.#contentService.fetchPublications();
    event?.target.complete();
  }
}
