import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';

import {
  IonButton,
  IonButtons,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  bookmark,
  bookmarkOutline,
  chevronDownOutline,
  chevronUpOutline,
  playOutline,
  searchOutline,
  volumeHighOutline,
} from 'ionicons/icons';
import { VocabularyService } from '../../home/vocabulary/vocabulary.service';
import { MarkdownService } from '../../home/content/markdown.service';
import { DictionaryService } from '../../home/dictionary/dictionary.service';
import { type ILemma } from '../../home/dictionary/lemma/lemma.model';
import { WordLang } from '../../home/dictionary/word-lang.model';
import { segmentIndonesian, type SegmentResult } from '../../home/dictionary/indonesian-segmenter';
import { SpeechSynthesizerService } from '../../home/speech-synthesizer.service';
import { langConfig } from '../../app.constants';

/** One homonym group: its rendered definition plus an optional affix breakdown. */
interface HomonymView {
  definition: SafeHtml;
  /** Present only for derived readings (keyword word != base); null for roots. */
  breakdown: SegmentResult | null;
}

@Component({
  selector: 'app-word-click-modal',
  imports: [
    IonLabel,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonItem,
    TranslatePipe,
  ],
  templateUrl: './word-click-modal.component.html',
  styleUrl: './word-click-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordClickModalComponent implements OnInit {
  #router = inject(Router);
  #modalCtrl = inject(ModalController);
  #sanitizer = inject(DomSanitizer);
  #dictionaryService = inject(DictionaryService);
  #markdownService = inject(MarkdownService);
  #speechService = inject(SpeechSynthesizerService);

  protected vocabularyService = inject(VocabularyService);

  clickedWord = input.required<string>();
  word = input.required<string>();
  lang = input.required<string>();
  sentence = input.required<string>();
  /** Marked-up form of the sentence (target words wrapped in <span>), stored as the
   * flashcard's source-sentence so the card can reuse the same tappable words. */
  sentenceHtml = input<string>('');
  lemmas = input.required<ILemma[]>();
  /** When true (e.g. opened from SRS review) hide the bookmark and dictionary-lookup
   * actions, leaving a view-only modal (definition + audio). */
  hideActions = input<boolean>(false);
  homonyms = signal<HomonymView[]>([]);
  /** Indices whose nasal-allomorphy rule note is expanded. */
  expanded = signal<Set<number>>(new Set());

  protected isBookmarked = computed(() =>
    this.vocabularyService.isBookmarked(this.clickedWord(), this.lang()),
  );

  protected titleLabel = computed(() => {
    // The arrow shows the single most informative hop from the clicked word to the
    // headword whose definition is on screen:
    //  - If the lookup *resolved* to a different form (a passive matched via its
    //    active sibling), show that hop: dipercaya → mempercaya. The root stays on
    //    the breakdown line (di- + percaya).
    //  - Otherwise the clicked word matched directly; if it is an inflection, point
    //    at its root headword: mengambil → ambil. A bare root shows no arrow.
    const clicked = this.clickedWord();
    const word = this.word();
    if (word !== clicked) return `${clicked} → ${word}`;
    const bases = [...new Set(this.lemmas().map((lemma) => lemma.baseWord))];
    return bases.includes(clicked) ? clicked : `${clicked} → ${bases.join(', ')}`;
  });

  ngOnInit() {
    // Group lemmas by homonym
    const homonymMap = new Map<string, ILemma[]>();
    for (const lemma of this.lemmas()) {
      const key = lemma.baseWord + '.' + lemma.homonym;
      homonymMap.set(key, [...(homonymMap.get(key) ?? []), lemma]);
    }

    const homonyms: HomonymView[] = [];

    for (const lemmas of homonymMap.values()) {
      let first = true;
      const texts = lemmas.map((lemma) => {
        const text = lemma.text.trim();
        if (first) {
          first = false;
          return text;
        }
        // Remove redundant keyword prefix
        const regexp = new RegExp(`\\*\\*${lemma.word}\\*\\*, *(\\d+)`);
        return text.replace(regexp, '$1');
      });
      const homonymText = this.#markdownService.tinyMarkdown(texts.join(' ').replace(/;$/, '.'));
      const definition = this.#sanitizer.bypassSecurityTrustHtml(homonymText);

      homonyms.push({ definition, breakdown: this.#breakdownFor(lemmas[0].baseWord) });
    }

    this.homonyms.set(homonyms);
  }

  /**
   * Affix breakdown for a reading, or null. Only derived readings (the keyword word
   * differs from its dictionary base) of target-language words get one; root readings
   * (base == clicked word) and native-language words get nothing. The root is the
   * lemma's `baseWord`, already attested by Teeuw, so this is pure synchronous work.
   */
  #breakdownFor(baseWord: string): SegmentResult | null {
    if (this.lang() !== langConfig.targetLang) return null;
    if (baseWord === this.clickedWord()) return null;
    return segmentIndonesian(this.clickedWord(), baseWord);
  }

  toggleExpanded(index: number) {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  dictionaryLookup() {
    this.#modalCtrl.dismiss(null, 'close');
    this.#router.navigate(['home/tabs/dictionary']);
    this.#dictionaryService.lookup(new WordLang(this.word(), this.lang()));
  }

  canSpeak() {
    return this.#speechService.canSpeakLanguage(this.lang());
  }

  speakWord() {
    this.#speechService.speakSingle(this.clickedWord(), this.lang()).subscribe({ error: () => {} });
  }

  speakSentence() {
    this.#speechService.speakSingle(this.sentence(), this.lang()).subscribe({ error: () => {} });
  }

  constructor() {
    addIcons({
      bookmark,
      bookmarkOutline,
      playOutline,
      volumeHighOutline,
      searchOutline,
      chevronDownOutline,
      chevronUpOutline,
    });
  }
}
