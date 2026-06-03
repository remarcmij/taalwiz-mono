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
    spanEl?.scrollIntoView({ block: 'start', inline: 'start', behavior: 'instant' });
  }

  onClicked(event: MouseEvent) {
    if (!(event.target instanceof HTMLSpanElement)) {
      return;
    }

    if (event.target.classList.contains('hashtag')) {
      // The span keeps the author's original casing for display, but tags are
      // indexed/stored lowercase, so normalise before looking up occurrences.
      const hashtagName = event.target.textContent?.substring(1).toLowerCase();
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
