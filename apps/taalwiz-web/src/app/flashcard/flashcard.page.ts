import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonFooter,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonProgressBar,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToolbar,
  Platform,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  refreshOutline,
  shuffleOutline,
  volumeHighOutline,
  volumeMuteOutline,
} from 'ionicons/icons';

import { map, Observable, tap } from 'rxjs';

import Swiper from 'swiper';
import { Navigation } from 'swiper/modules';

import { NgClass } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { SpeechSynthesizerService } from '../home/speech-synthesizer.service';
import { BackButtonComponent } from '../shared/back-button/back-button.component';

import {
  Flashcard,
  flashCardMode,
  FlashcardSection,
  FlashcardService,
  shuffle,
} from './flashcard.service';

@Component({
  selector: 'app-flashcard',
  imports: [
    NgClass,
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonItem,
    IonText,
    IonSelect,
    IonSelectOption,
    IonProgressBar,
    IonFooter,
    IonButton,
    IonIcon,
    TranslatePipe,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './flashcard.page.html',
  styleUrls: ['./flashcard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlashcardPage {
  #route = inject(ActivatedRoute);
  #flashcardService = inject(FlashcardService);
  #speechService = inject(SpeechSynthesizerService);
  #platform = inject(Platform);

  #flashcardSections$: Observable<FlashcardSection[]> = this.#route.data.pipe(
    map(({ article }) => article),
    tap((article) => this.title.set(article.title)),
    map((article) => this.#flashcardService.extractFlashcards(article.mdText)),
    tap((flashcardSections) => this.prepareFlashcards(flashcardSections))
  );

  flashcardSections = toSignal(this.#flashcardSections$, {
    initialValue: [] as FlashcardSection[],
  });

  title = signal('');

  flashcards = signal<Flashcard[]>([]);
  progress = signal(0);
  isDesktop = signal(false);
  flashcardMode = signal<flashCardMode>('foreignFirst');

  #sectionIndex = 0;

  swiperModules = [Navigation];
  swiperInstance!: Swiper;

  // ref: https://github.com/ionic-team/slides-migration-samples/blob/swiper/angular/src/app/home/home.page.ts
  @ViewChild('swiper')
  set swiper(swiperRef: ElementRef) {
    /**
     * This setTimeout waits for Ionic's async initialization to complete.
     * Otherwise, an outdated swiper reference will be used.
     */
    setTimeout(() => {
      this.swiperInstance = swiperRef.nativeElement.swiper;
      this.setupEventHandlers();
    }, 0);
  }

  constructor() {
    this.isDesktop.set(this.#platform.is('desktop'));
    console.log('this.isDesktop()', this.isDesktop());
    addIcons({
      refreshOutline,
      shuffleOutline,
      volumeHighOutline,
      volumeMuteOutline,
    });
  }

  handleChange(e: { detail: { value: number } }) {
    this.#sectionIndex = e.detail.value;
    this.prepareFlashcards(this.flashcardSections());
    this.onSlideDidChange();
  }

  private prepareFlashcards(flashcardSections: FlashcardSection[]) {
    const section = flashcardSections[this.#sectionIndex];
    const flashcards = section.flashcards.map((flashcard) =>
      this.#flashcardService.formatFlashcard(
        flashcard,
        'nl-NL',
        'id-ID',
        this.flashcardMode()
      )
    );
    this.flashcards.set(flashcards);
    if (this.swiperInstance) {
      setTimeout(() => {
        this.progress.set(0);
        this.swiperInstance.activeIndex = 0;
        this.swiperInstance.update();
      }, 0);
    }
  }

  setupEventHandlers() {
    this.swiperInstance.on('progress', (swiper, progress) => {
      this.progress.set(progress);
    });
  }

  get activeIndex() {
    return this.swiperInstance?.activeIndex ?? 0;
  }

  get activeFlashcard() {
    const index = Math.floor(this.activeIndex / 2);
    return this.flashcards()[index];
  }

  ionViewDidEnter() {
    this.onSlideDidChange();
  }

  onSlideDidChange() {
    if (!this.swiperInstance) return;

    const index = Math.floor(this.swiperInstance.activeIndex / 2);
    const isOdd = this.swiperInstance.activeIndex % 2 === 1;
    const flashcard = this.flashcards()[index];

    let word, lang;
    if (isOdd) {
      word = flashcard.answer.text;
      lang = flashcard.answer.lang;
    } else {
      word = flashcard.prompt.text;
      lang = flashcard.prompt.lang;
    }

    if (this.#flashcardService.isSpeaking && lang === 'id-ID') {
      this.#speechService.speakSingle(word, lang).subscribe();
    }
  }

  get isSpeaking() {
    return this.#flashcardService.isSpeaking;
  }

  toggleIsSpeaking() {
    this.#flashcardService.toggleIsSpeaking();
    if (this.isSpeaking) {
      this.onSlideDidChange();
    }
  }

  toggleLanguage() {
    this.flashcardMode.update((mode) =>
      mode === 'foreignFirst' ? 'nativeFirst' : 'foreignFirst'
    );
    this.prepareFlashcards(this.flashcardSections());
    this.onSlideDidChange();
  }

  shuffleFlashcards() {
    this.progress.set(0);
    this.swiperInstance.activeIndex = 0;
    this.flashcards.update((flashcards) => shuffle(flashcards));
    this.swiperInstance.update();
    this.onSlideDidChange();
  }

  restart() {
    this.progress.set(0);
    this.swiperInstance.activeIndex = 0;
    this.swiperInstance.update();
    this.onSlideDidChange();
  }
}
