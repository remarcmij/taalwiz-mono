import { ChangeDetectionStrategy, Component, HostListener, computed, inject, input, OnInit, signal } from '@angular/core';
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
import { VocabularyService } from '../../vocabulary/vocabulary.service';
import { SrsItem, SrsRating, StudyService } from '../study.service';

type Screen = 'picker' | 'loading' | 'card' | 'no-due' | 'complete';

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
  protected vocabularyService = inject(VocabularyService);

  readonly screen = signal<Screen>('picker');
  readonly selectedListId = signal<string>('');
  readonly queue = signal<SrsItem[]>([]);
  readonly currentIndex = signal<number>(0);
  readonly flipped = signal<boolean>(false);
  readonly definition = signal<string>('');
  readonly baseWordNote = signal<string | null>(null);
  readonly reviewedCount = signal<number>(0);

  readonly currentCard = computed(() => this.queue()[this.currentIndex()] ?? null);
  readonly definitionHtml = computed(() =>
    this.definition() ? this.#markdownService.convertMarkdown(this.definition()) : '',
  );
  readonly progress = computed(() => {
    const total = this.queue().length + this.reviewedCount();
    return total > 0 ? this.reviewedCount() / total : 0;
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
      if (key === ' ') { event.preventDefault(); void this.flipCard(); }
    } else {
      if (key === '1') this.rate('again');
      else if (key === '2') this.rate('good');
      else if (key === '3') this.rate('easy');
    }
  }

  ngOnInit(): void {
    this.selectedListId.set(this.defaultListId());
  }

  selectList(id: string): void {
    this.selectedListId.set(id);
  }

  async startSession(): Promise<void> {
    this.screen.set('loading');
    const cards = await firstValueFrom(this.#studyService.getDueCards(this.selectedListId()));
    this.queue.set(cards ?? []);
    this.currentIndex.set(0);
    this.reviewedCount.set(0);
    this.flipped.set(false);
    this.screen.set(cards && cards.length > 0 ? 'card' : 'no-due');
  }

  async flipCard(): Promise<void> {
    if (this.flipped()) return;
    const card = this.currentCard();
    if (!card) return;

    if (card.back) {
      this.definition.set(card.back);
      this.baseWordNote.set(null);
    } else {
      const result = await firstValueFrom(this.#dictionaryService.fetchWordLemmas(card.term, card.lang));
      const firstLemma = result.lemmas[0];
      this.definition.set(firstLemma?.text ?? '');
      this.baseWordNote.set(result.word !== card.term ? result.word : null);
    }
    this.flipped.set(true);
  }

  rate(rating: SrsRating): void {
    const card = this.currentCard();
    if (!card) return;

    this.#studyService
      .submitReview(card.term, card.lang, card.listId, rating)
      .subscribe();

    this.reviewedCount.update((n) => n + 1);
    const nextIndex = this.currentIndex() + 1;
    if (nextIndex < this.queue().length) {
      this.currentIndex.set(nextIndex);
      this.flipped.set(false);
      this.definition.set('');
      this.baseWordNote.set(null);
    } else {
      this.screen.set('complete');
    }
  }

  close(): void {
    this.#modalCtrl.dismiss();
  }
}
