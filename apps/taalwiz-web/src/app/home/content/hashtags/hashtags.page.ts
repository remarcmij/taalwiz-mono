import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewChild } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';

import { TranslatePipe } from '@ngx-translate/core';
import { HashtagModalComponent } from './hashtag-modal/hashtag-modal.component';
import { HashtagsService } from './hashtags.service';

@Component({
  selector: 'app-hashtags',
  imports: [
    AsyncPipe,
    TranslatePipe,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonChip,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonMenuButton,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './hashtags.page.html',
  styleUrls: ['./hashtags.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HashtagsPage {
  #modalCtrl = inject(ModalController);
  #hashtagsService = inject(HashtagsService);

  @ViewChild(IonModal) modal!: IonModal;

  hashtagGroups$ = this.#hashtagsService.getHashtagIndex();

  handleRefresh(event?: { target: { complete: () => void } }) {
    this.hashtagGroups$ = this.#hashtagsService.getHashtagIndex();
    event?.target.complete();
  }

  async openModal(hashtagName: string) {
    const modal = await this.#modalCtrl.create({
      component: HashtagModalComponent,
      componentProps: { hashtagName },
      initialBreakpoint: 0.5,
      breakpoints: [0, 0.25, 0.5, 0.75],
      handleBehavior: 'cycle',
    });
    modal.present();
  }
}
