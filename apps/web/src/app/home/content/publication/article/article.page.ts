import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { listOutline } from 'ionicons/icons';
import { map } from 'rxjs';

import { BackButtonComponent } from '../../../../shared/back-button/back-button.component';
import { WordClickModalService } from '../../../../shared/word-click-modal/word-click-modal.service';
import { HashtagModalComponent } from '../../hashtags/hashtag-modal/hashtag-modal.component';
import { ArticleBodyComponent } from './article-body/article-body.component';
import { IArticle } from './article.model';
import { extractHeadings, type IHeading } from './extract-headings.util';
import { TocService } from './toc.service';

@Component({
  selector: 'app-article',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonIcon,
    IonMenuButton,
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
  #tocService = inject(TocService);

  constructor() {
    addIcons({ listOutline });
  }

  #article$ = this.#route.data.pipe(map(({ article }) => article as IArticle | null));

  article = toSignal(this.#article$, { initialValue: null });
  headings = computed<IHeading[]>(() => {
    const article = this.article();
    return article ? extractHeadings(article.htmlText) : [];
  });

  ionViewWillEnter() {
    this.#tocService.headings.set(this.headings());
  }

  ionViewWillLeave() {
    this.#tocService.headings.set([]);
  }

  ionViewDidEnter() {
    const hashtagId = this.#tocService.scrollToId();
    if (!hashtagId) return;
    this.#tocService.scrollToId.set(null);
    const spanEl = document.querySelector(`#_${hashtagId}_`);
    // Vertical scroll only; `inline: 'nearest'` avoids a sideways jump.
    spanEl?.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
  }

  onClicked(event: MouseEvent) {
    if (!(event.target instanceof HTMLSpanElement)) {
      return;
    }

    if (event.target.classList.contains('hashtag')) {
      this.#openHashtag(event.target);
    } else {
      this.#wordClickModalService.onClicked(event);
    }
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!(event.target instanceof HTMLSpanElement)) return;
    if (!event.target.classList.contains('hashtag')) return;
    // Activate a focused tag like a button; prevent Space from scrolling.
    event.preventDefault();
    this.#openHashtag(event.target);
  }

  #openHashtag(span: HTMLSpanElement) {
    // The canonical lowercase tag lives in data-tag, so the lookup is independent
    // of how the visible text (casing, the decorative '#') is rendered.
    const hashtagName = span.dataset['tag'];
    if (hashtagName) {
      this.openHashtagModal(hashtagName);
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
