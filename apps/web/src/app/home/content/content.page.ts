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
import { Subject, switchMap } from 'rxjs';
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

  #refresh$ = new Subject<void>();
  topics$ = this.#refresh$.pipe(switchMap(() => this.#contentService.fetchPublications()));

  ionViewWillEnter() {
    this.#refresh$.next();
  }

  handleRefresh(event?: { target: { complete: () => void } }) {
    this.#refresh$.next();
    event?.target.complete();
  }
}
