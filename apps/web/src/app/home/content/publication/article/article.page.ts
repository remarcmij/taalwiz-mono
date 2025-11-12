import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { schoolOutline } from 'ionicons/icons';
import { filter, first, map } from 'rxjs';

import { BackButtonComponent } from '../../../../shared/back-button/back-button.component';
import { WordClickModalService } from '../../../../shared/word-click-modal/word-click-modal.service';
import { HashtagModalComponent } from '../../hashtags/hashtag-modal/hashtag-modal.component';
import { ArticleBodyComponent } from './article-body/article-body.component';
import { IArticle } from './article.model';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    RouterLink,
    ArticleBodyComponent,
    BackButtonComponent,
  ],
  templateUrl: './article.page.html',
  styleUrls: ['./article.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticlePage {
  #route = inject(ActivatedRoute);
  #modalCtrl = inject(ModalController);
  #wordClickModalService = inject(WordClickModalService);

  #article$ = this.#route.data.pipe<IArticle>(map(({ article }) => article));

  article = toSignal(this.#article$, { initialValue: {} as IArticle });

  hasFlashcards = computed(
    () => this.article().htmlText.indexOf(`<!-- flashcard -->`) !== -1,
  );

  constructor() {
    addIcons({
      schoolOutline,
    });
  }

  ionViewDidEnter() {
    this.#route.queryParamMap
      .pipe(
        first(),
        map((queryParamMap) => queryParamMap.get('id')),
        filter((hashtagId) => !!hashtagId),
        map((hashtagId) => document.querySelector(`#_${hashtagId}_`)),
        filter((spanEl) => !!spanEl),
      )
      .subscribe((spanEl) => {
        spanEl.scrollIntoView({
          block: 'start',
          inline: 'start',
          behavior: 'instant',
        });
      });
  }

  onClicked(event: MouseEvent) {
    if (!(event.target instanceof HTMLSpanElement)) {
      return;
    }

    if (event.target.classList.contains('hashtag')) {
      const hashtagName = event.target.textContent?.substring(1);
      if (hashtagName) {
        this.openHashtagModal(hashtagName);
      }
    } else {
      this.#wordClickModalService.onClicked(event);
    }
  }

  async openHashtagModal(hashtagName: string) {
    const modal = await this.#modalCtrl.create({
      component: HashtagModalComponent,
      componentProps: { hashtagName, article: this.article() },
      initialBreakpoint: 0.5,
      breakpoints: [0, 0.25, 0.5, 0.75],
    });
    modal.present();
  }
}
