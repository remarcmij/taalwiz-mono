import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { Platform } from '@ionic/angular';
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
  IonText,
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
    IonRefresher,
    IonRefresherContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonChip,
    IonLabel,
    IonText,
    IonButton,
    TranslatePipe,
  ],
  templateUrl: './hashtags.page.html',
  styleUrls: ['./hashtags.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HashtagsPage implements OnInit {
  #modalCtrl = inject(ModalController);
  #platform = inject(Platform);
  #hashtagsService = inject(HashtagsService);

  @ViewChild(IonModal) modal!: IonModal;

  hashtagGroups$ = this.#hashtagsService.getHashtagIndex();

  isDesktop = this.#platform.is('desktop');
  giveUpWaiting = signal(false);

  ngOnInit(): void {
    setTimeout(() => {
      this.giveUpWaiting.set(true);
    }, 1000);
  }

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
