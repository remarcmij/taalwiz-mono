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
    const target = event.target;

    // Quiz blanks are authored as `~~...~~` strikethrough, which renders to a
    // <del>. Because strikethrough text is never wrapped in a word-span (those
    // only appear inside emphasis), it cannot collide with tap-to-search.
    if (target instanceof HTMLElement && target.tagName === 'DEL') {
      this.#onQuizBlankClicked(target);
      return;
    }

    if (!(target instanceof HTMLSpanElement)) {
      return;
    }

    // A tapped multiple-choice option (a chip created client-side inside a
    // <del>); checked before the word-lookup branch since it is also a span.
    if (target.classList.contains('quiz-option')) {
      this.#answerQuizOption(target);
    } else if (target.classList.contains('hashtag')) {
      this.#openHashtag(target);
    } else {
      this.#wordClickModalService.onClicked(event);
    }
  }

  #onQuizBlankClicked(del: HTMLElement) {
    // Multiple-choice blanks are expanded into chips on first tap and then
    // become inert at the container level; option taps are handled separately.
    if (del.classList.contains('expanded') || del.classList.contains('locked')) {
      return;
    }

    const text = del.textContent ?? '';
    if (text.includes('|')) {
      this.#expandQuizOptions(del, text);
    } else {
      // Single-answer recall blank: toggle the answer in and out of view.
      del.classList.toggle('revealed');
    }
  }

  #expandQuizOptions(del: HTMLElement, text: string) {
    const options = text
      .split('|')
      .map((option) => option.trim())
      .filter((option) => option.length > 0)
      .map((option) => {
        // The correct option is flagged with a leading '='; strip the marker.
        const isCorrect = option.startsWith('=');
        return { label: isCorrect ? option.slice(1).trim() : option, isCorrect };
      });

    // Shuffle (Fisher-Yates) so the correct option's source position is hidden.
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    del.replaceChildren(
      ...options.map(({ label, isCorrect }) => {
        // textContent (not innerHTML) keeps the label escaped.
        const span = document.createElement('span');
        span.className = 'quiz-option';
        span.dataset['correct'] = String(isCorrect);
        span.textContent = label;
        return span;
      }),
    );
    del.classList.add('expanded');
  }

  #answerQuizOption(option: HTMLSpanElement) {
    const del = option.closest('del');
    if (!del || del.classList.contains('locked')) {
      return;
    }

    // One-shot: mark the chosen chip, reveal the correct one on a wrong guess,
    // then lock the blank so it can no longer be answered.
    const isCorrect = option.dataset['correct'] === 'true';
    option.classList.add(isCorrect ? 'correct' : 'incorrect');
    if (!isCorrect) {
      del.querySelector('.quiz-option[data-correct="true"]')?.classList.add('correct');
    }
    del.classList.add('locked');
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
