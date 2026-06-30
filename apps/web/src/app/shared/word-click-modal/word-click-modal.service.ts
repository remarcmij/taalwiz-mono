import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';
import { langConfig } from '../../app.constants';
import { DictionaryService } from '../../home/dictionary/dictionary.service';
import { type ILemma } from '../../home/dictionary/lemma/lemma.model';
import { WordLang } from '../../home/dictionary/word-lang.model';
import { WordClickModalComponent } from './word-click-modal.component';

const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

@Injectable({
  providedIn: 'root',
})
export class WordClickModalService {
  #dictionaryService = inject(DictionaryService);
  #router = inject(Router);
  #modalCtrl = inject(ModalController);

  onClicked(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // Only emphasised target-language words are wrapped in a <span> (and coloured
    // teal); native (Dutch) text is a plain text node, so a tap on or near it
    // surfaces a non-span target. Ignore those so the modal opens only on a word.
    if (target.tagName !== 'SPAN') return;

    event.preventDefault();
    event.stopPropagation();

    const wordLang = this.getWordClickParams(target);
    if (!wordLang) return;

    // Desktop accelerator: Cmd-click (Mac) / Ctrl-click (Win/Linux) skips the modal and
    // searches the word directly in the dictionary, which resolves inflected forms via
    // the same variation generator the modal uses. Touch has no modifier keys, so this
    // is naturally desktop-only.
    if (event.metaKey || event.ctrlKey) {
      void this.#router.navigate(['home/tabs/dictionary']);
      this.#dictionaryService.lookup(wordLang);
      return;
    }

    // Speech reads only the target-language phrase the word sits in. Each target word
    // is a <span> inside one <em>/<strong> emphasis group, while native (Dutch) text is
    // a plain-text sibling outside it, so the parent element's text is the foreign phrase
    // alone — speaking the whole block would read the Dutch in the foreign voice.
    const speech = target.parentElement?.textContent?.trim() ?? '';

    target.classList.add('clicked');

    this.fetchLemmas(removeAccents(wordLang.word), wordLang.lang).subscribe({
      next: (response) => {
        const { word, lang, lemmas } = response;
        this.#present({
          clickedWord: wordLang.word,
          word,
          lang,
          speech,
          lemmas,
          onDismiss: () => target.classList.remove('clicked'),
        });
      },
      error: () => {
        target.classList.remove('clicked');
      },
    });
  }

  /**
   * View-only lookup from an SRS study card back: definition + audio only, with no
   * bookmark / dictionary-nav / quiz actions and no Cmd-click accelerator (mid-study
   * the user should not wander off).
   */
  openViewOnly(event: MouseEvent): void {
    this.#openSpanLookup(event, { hideActions: true });
  }

  /**
   * Lookup from the deck-as-content view: the full reading actions (dictionary-nav,
   * breakdown, audio) EXCEPT the bookmark — every tappable word is already a card in
   * this deck, so its toggle would only remove it (the accidental un-bookmark lock
   * guards against). Not a session, so the dictionary jump is welcome.
   */
  openWithoutBookmark(event: MouseEvent): void {
    this.#openSpanLookup(event, { hideBookmark: true });
  }

  /** Shared span-tap lookup for the reduced-action surfaces (study card / content
   *  view). Only fires on an emphasised word <span>; other taps are ignored. */
  #openSpanLookup(
    event: MouseEvent,
    flags: { hideActions?: boolean; hideBookmark?: boolean },
  ): void {
    const target = event.target as HTMLElement;
    if (target.tagName !== 'SPAN') return;
    event.stopPropagation();

    const wordLang = this.getWordClickParams(target);
    if (!wordLang) return;

    const speech = target.parentElement?.textContent?.trim() ?? '';
    target.classList.add('clicked');

    this.fetchLemmas(removeAccents(wordLang.word), wordLang.lang).subscribe({
      next: ({ word, lang, lemmas }) => {
        this.#present({
          clickedWord: wordLang.word,
          word,
          lang,
          speech,
          lemmas,
          hideActions: flags.hideActions,
          hideBookmark: flags.hideBookmark,
          onDismiss: () => target.classList.remove('clicked'),
        });
      },
      error: () => target.classList.remove('clicked'),
    });
  }

  #present(opts: {
    clickedWord: string;
    word: string;
    lang: string;
    speech?: string;
    lemmas: ILemma[];
    hideActions?: boolean;
    hideBookmark?: boolean;
    onDismiss?: () => void;
  }): void {
    this.#modalCtrl
      .create({
        component: WordClickModalComponent,
        componentProps: {
          clickedWord: opts.clickedWord,
          word: opts.word,
          lang: opts.lang,
          speech: opts.speech ?? '',
          lemmas: opts.lemmas,
          hideActions: opts.hideActions ?? false,
          hideBookmark: opts.hideBookmark ?? false,
        },
        cssClass: 'word-click-modal',
        initialBreakpoint: 0.25,
        breakpoints: [0, 0.25, 0.5],
        handleBehavior: 'cycle',
      })
      .then((modal) => {
        modal.present();
        if (opts.onDismiss) modal.onDidDismiss().then(opts.onDismiss);
      });
  }

  fetchLemmas(word: string, lang: string) {
    return this.#dictionaryService.fetchWordLemmas(word, lang);
  }

  getWordClickParams(target: HTMLElement): WordLang | null {
    let word = target.innerText.trim();
    word = this.#cleanseTerm(word);
    return new WordLang(word, langConfig.targetLang);
  }

  #cleanseTerm(term: string): string {
    const match = term.match(/[-'()a-zA-Z\u00C0-\u00FF]{2,}/g);
    if (match) {
      term = match[0];
    }
    term = term.trim().toLowerCase();
    return term.replace(/\(.*?\)/g, '').replace(/[()]/g, '') || term.replace(/[()]/g, '');
  }
}
