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
    event.preventDefault();
    event.stopPropagation();
    const target = event.target as HTMLInputElement;

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

    const { text: sentence, html: sentenceHtml } = this.#extractSentence(target);
    // Speech reads only the target-language phrase the word sits in. Each target word
    // is a <span> inside one <em>/<strong> emphasis group, while native (Dutch) text is
    // a plain-text sibling outside it, so the parent element's text is the foreign phrase
    // alone. This deliberately differs from `sentence` (whole block, kept bilingual for
    // flashcard context): speaking the block would read the Dutch in the foreign voice.
    const speech = target.parentElement?.textContent?.trim() ?? '';

    target.classList.add('clicked');

    this.fetchLemmas(removeAccents(wordLang.word), wordLang.lang).subscribe({
      next: (response) => {
        const { word, lang, lemmas } = response;
        this.#present({
          clickedWord: wordLang.word,
          word,
          lang,
          sentence,
          sentenceHtml,
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
   * Open the word modal for a known term (e.g. from an SRS card), bypassing DOM
   * extraction. The modal is view-only: bookmark and dictionary-lookup actions are
   * hidden, leaving the full definition plus word/sentence audio.
   */
  openForTerm(term: string, lang: string, sentence: string): void {
    this.fetchLemmas(removeAccents(term), lang).subscribe({
      next: (response) => {
        this.#present({
          clickedWord: term,
          word: response.word,
          lang: response.lang,
          sentence: sentence.trim(),
          // No DOM to narrow to the foreign phrase here, and the stored source sentence
          // can be bilingual, so leave `speech` empty: the audio button falls back to
          // pronouncing just the tapped word (never native text in the foreign voice).
          lemmas: response.lemmas,
          hideActions: true,
        });
      },
      error: () => {},
    });
  }

  #present(opts: {
    clickedWord: string;
    word: string;
    lang: string;
    sentence: string;
    sentenceHtml?: string;
    speech?: string;
    lemmas: ILemma[];
    hideActions?: boolean;
    onDismiss?: () => void;
  }): void {
    this.#modalCtrl
      .create({
        component: WordClickModalComponent,
        componentProps: {
          clickedWord: opts.clickedWord,
          word: opts.word,
          lang: opts.lang,
          sentence: opts.sentence,
          sentenceHtml: opts.sentenceHtml ?? '',
          speech: opts.speech ?? '',
          lemmas: opts.lemmas,
          hideActions: opts.hideActions ?? false,
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

  /**
   * Narrow the clicked word's containing block (paragraph, list item, ...) down to
   * the single sentence the word appears in, so it can be stored as flashcard context.
   *
   * Returns both a plain-text form (used for speech and comparisons) and an HTML form
   * that preserves the original markup: target-language words stay wrapped in <span>
   * (inside <strong>/<em>), native words remain plain text. The card reuses those
   * spans so only the words tappable while reading are tappable on the flashcard.
   * Falls back to the full block when no sentence boundary is found.
   */
  #extractSentence(target: HTMLElement): { text: string; html: string } {
    const block =
      target.closest('p, li, blockquote, dd, h1, h2, h3, h4, h5, h6, td') ?? target.parentElement;
    if (!block) {
      const t = target.textContent?.trim() ?? '';
      return { text: t, html: t };
    }

    const full = block.textContent ?? '';
    const before = document.createRange();
    before.setStart(block, 0);
    before.setEndBefore(target);
    const wordStart = before.toString().length;
    const wordEnd = wordStart + (target.textContent?.length ?? 0);

    const isTerminator = (ch: string) => ch === '.' || ch === '!' || ch === '?';

    let start = 0;
    for (let i = wordStart - 1; i >= 0; i--) {
      if (isTerminator(full[i])) {
        start = i + 1;
        break;
      }
    }
    let end = full.length;
    for (let i = wordEnd; i < full.length; i++) {
      if (isTerminator(full[i])) {
        end = i + 1;
        break;
      }
    }

    const text = full.slice(start, end).trim() || full.trim();

    // Clone the marked-up DOM for the same character range so word <span>s survive.
    const startPos = this.#positionAt(block, start);
    const endPos = this.#positionAt(block, end);
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    const holder = document.createElement('div');
    holder.appendChild(range.cloneContents());
    const html = holder.innerHTML.trim() || text;

    return { text, html };
  }

  /** Map a character offset within `root`'s text content to a (text node, offset) pair. */
  #positionAt(root: Node, charOffset: number): { node: Node; offset: number } {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let last: Node | null = null;
    let node = walker.nextNode();
    while (node) {
      const len = node.textContent?.length ?? 0;
      if (charOffset <= acc + len) return { node, offset: charOffset - acc };
      acc += len;
      last = node;
      node = walker.nextNode();
    }
    return last ? { node: last, offset: last.textContent?.length ?? 0 } : { node: root, offset: 0 };
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
