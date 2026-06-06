import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonProgressBar,
  IonRadio,
  IonRadioGroup,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { MarkdownService } from '../../content/markdown.service';
import { DictionaryService } from '../../dictionary/dictionary.service';
import { WordClickModalService } from '../../../shared/word-click-modal/word-click-modal.service';
import { PointerService } from '../../../shared/pointer.service';
import { VocabularyService } from '../../vocabulary/vocabulary.service';
import { SrsItem, SrsRating, StudyService } from '../study.service';

type Screen = 'picker' | 'loading' | 'card' | 'no-due' | 'complete';

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
    IonList,
    IonItem,
    IonLabel,
    IonRadioGroup,
    IonRadio,
    IonBadge,
    IonProgressBar,
    TranslatePipe,
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
  #wordClickModalService = inject(WordClickModalService);
  protected vocabularyService = inject(VocabularyService);
  protected pointer = inject(PointerService);

  readonly screen = signal<Screen>('picker');
  readonly selectedListId = signal<string>('');
  readonly queue = signal<SrsItem[]>([]);
  readonly currentIndex = signal<number>(0);
  readonly flipped = signal<boolean>(false);
  readonly definition = signal<string>('');
  readonly sourceSentence = signal<string>('');
  readonly baseWordNote = signal<string | null>(null);
  // Distinct cards in the session, fixed at start; `completed` counts cards that have
  // graduated (Good/Easy, or practice Next). An "Again" re-queue never inflates these.
  readonly sessionSize = signal<number>(0);
  readonly completed = signal<number>(0);
  readonly showRatingHint = signal<boolean>(false);
  // Practice ("cram") session: review every card in the list regardless of due date,
  // flip-and-next, without submitting reviews — the SRS schedule is left untouched.
  readonly practiceMode = signal<boolean>(false);

  readonly currentCard = computed(() => this.queue()[this.currentIndex()] ?? null);
  readonly definitionHtml = computed(() =>
    this.definition() ? this.#markdownService.convertMarkdown(this.definition()) : '',
  );
  // The source sentence is stored with its original markup (target words wrapped in
  // <span>), so it is rendered as-is: only those words are teal/tappable, native text
  // stays plain — exactly as when reading the article.
  readonly sourceSentenceHtml = computed(() => this.sourceSentence());
  readonly progress = computed(() => {
    const total = this.sessionSize();
    return total > 0 ? this.completed() / total : 0;
  });
  listsWithStats = computed(() =>
    this.vocabularyService.lists().map((list) => ({
      list,
      due: this.#studyService.stats().find((s) => s.listId === list.id)?.due ?? 0,
    })),
  );

  constructor() {
    addIcons({ closeOutline });
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
    this.selectedListId.set(this.defaultListId());
    // Open with up-to-date due counts in the picker.
    void this.#studyService.refreshStats();
    const { value } = await Preferences.get({ key: 'study.ratingHintDismissed' });
    if (!value) {
      this.showRatingHint.set(true);
    }
  }

  async dismissRatingHint(): Promise<void> {
    this.showRatingHint.set(false);
    await Preferences.set({ key: 'study.ratingHintDismissed', value: 'true' });
  }

  selectList(id: string): void {
    this.selectedListId.set(id);
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

    // Source sentence (word-tap cards) is shown as context alongside the answer.
    this.sourceSentence.set(card.sourceSentence ?? '');

    // The translation is the gradeable answer the rating buttons act on, so it
    // is always resolved: a stored back, otherwise the dictionary's first line
    // (the "View full entry" button reveals the full Teeuw entry when that is
    // not enough).
    if (card.back) {
      this.definition.set(card.back);
      this.baseWordNote.set(null);
    } else {
      const result = await firstValueFrom(
        this.#dictionaryService.fetchWordLemmas(card.term, card.lang),
      );
      const firstLemma = result.lemmas[0];
      this.definition.set(firstLemma?.text.replace(/[;,]\s*$/, '') ?? '');
      this.baseWordNote.set(result.word !== card.term ? result.word : null);
    }
    this.flipped.set(true);
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
      this.sourceSentence.set('');
      this.baseWordNote.set(null);
    } else {
      this.screen.set('complete');
    }
  }

  /** Tapping a target word — any preserved <span>, whether in the example sentence
   * or in the definition gloss (head-word `**bold**` or example `*italic*`) — opens
   * the view-only word modal for that word, with the sentence as spoken context.
   * Native (non-span) words are not tappable. */
  onWordClick(event: MouseEvent): void {
    const card = this.currentCard();
    if (!card) return;
    const span = (event.target as HTMLElement).closest('span');
    if (!span) return;
    const word = (span.textContent ?? '').toLowerCase().trim();
    if (word) this.#wordClickModalService.openForTerm(word, card.lang, this.#sourceSentenceText());
  }

  /** Plain-text form of the stored (marked-up) source sentence, for speech. */
  #sourceSentenceText(): string {
    const div = document.createElement('div');
    div.innerHTML = this.sourceSentence();
    return div.textContent ?? '';
  }

  close(): void {
    // A session may have rescheduled cards; refresh so the due-count badges
    // (picker and the vocabulary-page Study button) reflect reality.
    void this.#studyService.refreshStats();
    this.#modalCtrl.dismiss();
  }
}
