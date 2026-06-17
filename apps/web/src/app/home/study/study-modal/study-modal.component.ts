import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonProgressBar,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { langConfig } from '../../../app.constants';
import { MarkdownService } from '../../content/markdown.service';
import { DictionaryService } from '../../dictionary/dictionary.service';
import { segmentIndonesian, type SegmentResult } from '../../dictionary/indonesian-segmenter';
import { PointerService } from '../../../shared/pointer.service';
import { AffixBreakdownComponent } from '../../../shared/morphology/affix-breakdown/affix-breakdown.component';
import { WordClickModalService } from '../../../shared/word-click-modal/word-click-modal.service';
import { SrsItem, SrsRating, StudyService } from '../study.service';
import { VocabularyService } from '../../vocabulary/vocabulary.service';

type Screen = 'loading' | 'card' | 'no-due' | 'complete';

/** Fisher-Yates shuffle (returns a new array), used to randomise practice order. */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

@Component({
  selector: 'app-study-modal',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonTitle,
    IonContent,
    IonProgressBar,
    TranslatePipe,
    AffixBreakdownComponent,
  ],
  templateUrl: './study-modal.component.html',
  styleUrls: ['./study-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyModalComponent implements OnInit {
  defaultListId = input.required<string>();

  #modalCtrl = inject(ModalController);
  #studyService = inject(StudyService);
  #dictionaryService = inject(DictionaryService);
  #markdownService = inject(MarkdownService);
  #wordClickModal = inject(WordClickModalService);
  #vocabularyService = inject(VocabularyService);
  protected pointer = inject(PointerService);

  readonly screen = signal<Screen>('loading');
  readonly selectedListId = signal<string>('');
  readonly queue = signal<SrsItem[]>([]);
  readonly currentIndex = signal<number>(0);
  readonly flipped = signal<boolean>(false);
  readonly definition = signal<string>('');
  readonly baseWordNote = signal<string | null>(null);
  // Affix decomposition of a derived term, shown on the back alongside the
  // dictionary definition (only when the card has no custom back).
  readonly breakdown = signal<SegmentResult | null>(null);
  // Distinct cards in the session, fixed at start; `completed` counts cards that have
  // graduated (Good/Easy, or practice Next). An "Again" re-queue never inflates these.
  readonly sessionSize = signal<number>(0);
  readonly completed = signal<number>(0);
  readonly showRatingHint = signal<boolean>(false);
  // Practice ("cram") session: review every card in the list regardless of due date,
  // flip-and-next, without submitting reviews — the SRS schedule is left untouched.
  readonly practiceMode = signal<boolean>(false);

  // Whether the studied list has any cards at all. Distinguishes "no cards due"
  // (offer Practice) from an empty list (Practice would be a no-op, so hide it).
  readonly listHasCards = computed(
    () =>
      (this.#vocabularyService.lists().find((l) => l.id === this.selectedListId())?.count ?? 0) > 0,
  );

  readonly currentCard = computed(() => this.queue()[this.currentIndex()] ?? null);
  readonly definitionHtml = computed(() =>
    this.definition() ? this.#markdownService.convertMarkdown(this.definition()) : '',
  );
  readonly progress = computed(() => {
    const total = this.sessionSize();
    return total > 0 ? this.completed() / total : 0;
  });

  // The last card actually shown, captured so closing the modal can tell the
  // vocabulary list which card to scroll to (currentCard() is null once the
  // session completes).
  #lastShownCard: { term: string; lang: string } | null = null;

  constructor() {
    addIcons({ closeOutline });
    effect(() => {
      const card = this.currentCard();
      if (card) this.#lastShownCard = { term: card.term, lang: card.lang };
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: Event): void {
    if (this.screen() !== 'card') return;
    const key = (event as KeyboardEvent).key;
    if (!this.flipped()) {
      if (key === ' ') {
        event.preventDefault();
        void this.flipCard();
      }
    } else if (this.practiceMode()) {
      if (key === ' ' || key === 'Enter') {
        event.preventDefault();
        this.next();
      }
    } else {
      if (key === '1') this.rate('again');
      else if (key === '2') this.rate('good');
      else if (key === '3') this.rate('easy');
    }
  }

  async ngOnInit(): Promise<void> {
    const { value } = await Preferences.get({ key: 'study.ratingHintDismissed' });
    if (!value) {
      this.showRatingHint.set(true);
    }
    // Study the list that is already current on the vocabulary page — no list
    // picker, since that choice is made there. Go straight into its due session.
    this.selectedListId.set(this.defaultListId());
    await this.startSession();
  }

  async dismissRatingHint(): Promise<void> {
    this.showRatingHint.set(false);
    await Preferences.set({ key: 'study.ratingHintDismissed', value: 'true' });
  }

  async startSession(): Promise<void> {
    this.practiceMode.set(false);
    await this.#loadSession(false);
  }

  /** On-demand practice: review the whole list now, in random order, without
   * affecting the SRS schedule (no reviews are submitted). */
  async startPractice(): Promise<void> {
    this.practiceMode.set(true);
    await this.#loadSession(true);
  }

  async #loadSession(all: boolean): Promise<void> {
    this.screen.set('loading');
    const cards = (await firstValueFrom(this.#studyService.getDueCards(this.selectedListId(), all))) ?? [];
    this.queue.set(all ? shuffle(cards) : cards);
    this.sessionSize.set(cards.length);
    this.currentIndex.set(0);
    this.completed.set(0);
    this.flipped.set(false);
    this.screen.set(cards.length > 0 ? 'card' : 'no-due');
  }

  async flipCard(): Promise<void> {
    if (this.flipped()) return;
    const card = this.currentCard();
    if (!card) return;

    // The translation is the gradeable answer the rating buttons act on, so it
    // is always resolved: a stored back, otherwise the dictionary's first line
    // (the "View full entry" button reveals the full Teeuw entry when that is
    // not enough).
    if (card.back) {
      this.definition.set(card.back);
      this.baseWordNote.set(null);
      this.breakdown.set(null);
    } else {
      const result = await firstValueFrom(
        this.#dictionaryService.fetchWordLemmas(card.term, card.lang),
      );
      // The user may have pinned a non-default line for this back-less card; fall
      // back to the first line if the index is out of range (e.g. the lemma set
      // shrank since it was chosen).
      const lemma = result.lemmas[card.lemmaIndex] ?? result.lemmas[0];
      this.definition.set(lemma?.text.replace(/[;,]\s*$/, '') ?? '');
      this.baseWordNote.set(result.word !== card.term ? result.word : null);
      // For a derived target-language form, add the same affix decomposition the
      // word-tap modal shows. Segment against the lemma's ROOT (baseWord), not the
      // headword `result.word` — a headword can itself be affixed, which the
      // segmenter can't anchor on. Mirrors WordClickModal's #breakdownFor.
      const baseWord = lemma?.baseWord;
      this.breakdown.set(
        baseWord && baseWord !== card.term && card.lang === langConfig.targetLang
          ? segmentIndonesian(card.term, baseWord)
          : null,
      );
    }
    this.flipped.set(true);
  }

  /**
   * Tap on an emphasised word on the card back: open a view-only lookup
   * (definition + audio only). The flip gesture is already inert once flipped,
   * so this competes with nothing; the service ignores taps that miss a word.
   */
  onBackWordTap(event: MouseEvent): void {
    this.#wordClickModal.openFromStudyCard(event);
  }

  rate(rating: SrsRating): void {
    const card = this.currentCard();
    if (!card || this.practiceMode()) return;

    this.#studyService.submitReview(card.term, card.lang, card.listId, rating).subscribe();
    if (rating === 'again') {
      // "Again" keeps the card due (server sets dueDate=now): re-queue it so it comes
      // back later this session to be re-rated. It is not counted as completed.
      this.queue.update((q) => [...q, card]);
    } else {
      this.completed.update((n) => n + 1);
    }
    this.#advance();
  }

  /** Practice mode: move to the next card without rescheduling. */
  next(): void {
    if (!this.currentCard() || !this.practiceMode()) return;
    this.completed.update((n) => n + 1);
    this.#advance();
  }

  #advance(): void {
    const nextIndex = this.currentIndex() + 1;
    if (nextIndex < this.queue().length) {
      this.currentIndex.set(nextIndex);
      this.flipped.set(false);
      this.definition.set('');
      this.baseWordNote.set(null);
      this.breakdown.set(null);
    } else {
      this.screen.set('complete');
    }
  }

  close(): void {
    // A session may have rescheduled cards; refresh so the due-count badges
    // (picker and the vocabulary-page Study button) reflect reality.
    void this.#studyService.refreshStats();
    // Hand back the last card shown so the list can scroll to it (lets the user
    // jump straight to a card whose dictionary line they want to change).
    this.#modalCtrl.dismiss(this.#lastShownCard);
  }
}
