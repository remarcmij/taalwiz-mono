import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonThumbnail,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { ContentService } from '../../home/content/content.service';
import { type ITopic } from '../../home/content/topic.model';
import { BackButtonComponent } from '../../shared/back-button/back-button.component';

@Component({
  selector: 'app-content',
  imports: [
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonSpinner,
    IonList,
    IonItem,
    IonThumbnail,
    IonImg,
    IonLabel,
  ],
  templateUrl: './content.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentPage {
  #router = inject(Router);
  #contentService = inject(ContentService);

  topics = toSignal(this.#contentService.fetchPublications(), {
    initialValue: [] as ITopic[],
  });

  navigateToArticles(topic: ITopic) {
    this.#router.navigate(['/', 'admin', 'content', topic.groupName]);
  }
}
