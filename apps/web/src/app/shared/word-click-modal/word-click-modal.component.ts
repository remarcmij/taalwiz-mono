import {
  ChangeDetectionStrategy,
  Component,
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
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { playOutline, searchOutline, volumeHighOutline } from 'ionicons/icons';
import { MarkdownService } from '../../home/content/markdown.service';
import { DictionaryService } from '../../home/dictionary/dictionary.service';
import { type ILemma } from '../../home/dictionary/lemma/lemma.model';
import { WordLang } from '../../home/dictionary/word-lang.model';
import { SpeechSynthesizerService } from '../../home/speech-synthesizer.service';
import { SharedModule } from '../shared.module';

@Component({
  selector: 'app-word-click-modal',
  standalone: true,
  imports: [
    SharedModule,
    IonLabel,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonItem,
  ],
  templateUrl: './word-click-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WordClickModalComponent implements OnInit {
  #router = inject(Router);
  #modalCtrl = inject(ModalController);
  #sanitizer = inject(DomSanitizer);
  #dictionaryService = inject(DictionaryService);
  #markdownService = inject(MarkdownService);
  #speechService = inject(SpeechSynthesizerService);

  clickedWord = input.required<string>();
  word = input.required<string>();
  lang = input.required<string>();
  sentence = input.required<string>();
  lemmas = input.required<ILemma[]>();
  safeHomonyms = signal<SafeHtml[]>([]);

  ngOnInit() {
    // Group lemmas by homonym
    const homonymMap = new Map<string, ILemma[]>();
    for (const lemma of this.lemmas()) {
      const key = lemma.baseWord + '.' + lemma.homonym;
      homonymMap.set(key, [...(homonymMap.get(key) ?? []), lemma]);
    }

    const safeHomonyms: SafeHtml[] = [];

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
      const homonymText = this.#markdownService.tinyMarkdown(
        texts.join(' ').replace(/;$/, '.'),
      );

      const homonymHtml = this.#sanitizer.bypassSecurityTrustHtml(homonymText);
      safeHomonyms.push(homonymHtml);
    }

    this.safeHomonyms.set(safeHomonyms);
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
    this.#speechService
      .speakSingle(this.clickedWord(), this.lang())
      .subscribe();
  }

  speakSentence() {
    this.#speechService.speakSingle(this.sentence(), this.lang()).subscribe();
  }

  constructor() {
    addIcons({ playOutline, volumeHighOutline, searchOutline });
  }
}
