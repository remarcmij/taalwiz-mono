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
  arrowForwardOutline,
  bookmark,
  bookmarkOutline,
  eyeOutline,
  schoolOutline,
  volumeHighOutline,
} from 'ionicons/icons';
import { AffixBreakdownComponent } from '../morphology/affix-breakdown/affix-breakdown.component';
import { VocabularyService } from '../../home/vocabulary/vocabulary.service';
import { MarkdownService } from '../../home/content/markdown.service';
import { DictionaryService } from '../../home/dictionary/dictionary.service';
import { type ILemma } from '../../home/dictionary/lemma/lemma.model';
import { WordLang } from '../../home/dictionary/word-lang.model';
import { segmentIndonesian, type SegmentResult } from '../../home/dictionary/indonesian-segmenter';
import { SpeechSynthesizerService } from '../../home/speech-synthesizer.service';
import { MorphologyModeService } from '../morphology/morphology-mode.service';
import { PointerService } from '../pointer.service';
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
    AffixBreakdownComponent,
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
  protected morphologyMode = inject(MorphologyModeService);
  protected pointer = inject(PointerService);

  clickedWord = input.required<string>();
  word = input.required<string>();
  lang = input.required<string>();
  /** Text spoken by the audio button: the target-language phrase the clicked word
   * belongs to (its emphasis group), NOT the whole block. In bilingual content (grammar
   * tables/lists) the native text sits outside that group, so it is never read aloud in
   * the target-language voice. Falls back to the bare clicked word. */
  speech = input<string>('');
  lemmas = input.required<ILemma[]>();
  /** When true (opened from an SRS study card back) reduce the modal to
   * definition + audio only: hide the quiz toggle, bookmark and dictionary-lookup
   * actions, the affix breakdown, and the "→ word" hop. */
  hideActions = input<boolean>(false);
  /** When true (opened from the deck-as-content view) hide only the bookmark
   * button: the word is already a card in the active deck, so its toggle would
   * just remove it. The dictionary-lookup, breakdown and audio stay available. */
  hideBookmark = input<boolean>(false);
  homonyms = signal<HomonymView[]>([]);
  /** Indices whose breakdown has been revealed in quiz mode. Starts empty on each
   * open (the modal is recreated per tap), so quiz mode always hides first. */
  revealed = signal<Set<number>>(new Set());

  protected isBookmarked = computed(() =>
    this.vocabularyService.isBookmarked(this.clickedWord(), this.lang()),
  );


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

  // Invoked by the `→ word` hop link. Navigates to the full dictionary entry for the
  // resolved headword (`word`). The hop is shown even when `word === clickedWord`
  // (a plain root): it is NOT a no-op, because the modal body is the CONDENSED entry
  // (keyword senses only) while the dictionary page is the FULL entry with all derived
  // sub-lemmas. So "→ word" universally means "open the full entry" — do not suppress
  // it in the self-reference case.
  dictionaryLookup() {
    this.#modalCtrl.dismiss(null, 'close');
    this.#router.navigate(['home/tabs/dictionary']);
    this.#dictionaryService.lookup(new WordLang(this.word(), this.lang()));
  }

  canSpeak() {
    return this.#speechService.canSpeakLanguage(this.lang());
  }

  // Speaks the target-language phrase the word belongs to (its emphasis group), not the
  // whole block. This keeps native (Dutch) text in bilingual grammar tables/lists from
  // being read aloud in the target-language voice. Falls back to the bare clicked word.
  speakSentence() {
    const text = this.speech() || this.clickedWord();
    this.#speechService.speakSingle(text, this.lang()).subscribe({ error: () => {} });
  }

  toggleQuizMode() {
    // Reset any reveals so flipping back into quiz mode hides the breakdown again
    // (a revealed answer must not survive a Show -> Quiz round trip).
    this.revealed.set(new Set());
    void this.morphologyMode.toggle();
  }

  /** Reveal a breakdown that quiz mode is hiding (self-grade after guessing). */
  reveal(index: number) {
    this.revealed.update((set) => new Set(set).add(index));
  }

  constructor() {
    addIcons({
      bookmark,
      bookmarkOutline,
      volumeHighOutline,
      eyeOutline,
      schoolOutline,
      arrowForwardOutline,
    });
  }
}
