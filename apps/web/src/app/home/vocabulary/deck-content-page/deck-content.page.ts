import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { WordClickModalService } from '../../../shared/word-click-modal/word-click-modal.service';
import { MarkdownService } from '../../content/markdown.service';
import { CardDefinitionService } from '../../study/card-definition.service';
import { StudyService } from '../../study/study.service';
import { VocabularyService } from '../vocabulary.service';
import { buildCardContentLine } from './deck-content.util';

/** How many cards to resolve before the first paint, and the streaming batch size.
 * Large enough to fill the opening screen; the rest streams in after. */
const FIRST_CHUNK = 12;

/**
 * Renders the active deck as a Library-style content article: each card becomes a
 * tappable line (curated back, or a back-less card resolved to its dictionary line
 * + affix decomposition). Cards are resolved and painted in chunks so a large deck
 * shows its first screen immediately. A routed page (not a modal) so it behaves
 * like an article — the bottom tabs stay, and a "→" jump to the dictionary leaves
 * the reader alive in the tab's stack. Tapping a target word opens a lookup with
 * the bookmark hidden (the word is already a card here).
 */
@Component({
  selector: 'app-deck-content-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonSpinner,
    TranslatePipe,
  ],
  templateUrl: './deck-content.page.html',
  styleUrls: ['./deck-content.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeckContentPage implements OnInit {
  #vocabulary = inject(VocabularyService);
  #study = inject(StudyService);
  #cardDefinition = inject(CardDefinitionService);
  #markdown = inject(MarkdownService);
  #wordClickModal = inject(WordClickModalService);
  #sanitizer = inject(DomSanitizer);
  #translate = inject(TranslateService);

  protected deckName = computed(() => this.#vocabulary.currentList()?.name ?? '');
  protected html = signal<SafeHtml>('');
  /** False until the first chunk has painted (drives the full-screen spinner). */
  protected firstPainted = signal(false);
  /** False while later chunks are still resolving (drives the bottom spinner). */
  protected done = signal(false);
  protected isEmpty = signal(false);

  async ngOnInit(): Promise<void> {
    const listId = this.#vocabulary.currentListId();
    const cards = this.#vocabulary.bookmarks();
    if (!listId || cards.length === 0) {
      this.isEmpty.set(true);
      this.firstPainted.set(true);
      this.done.set(true);
      return;
    }

    const lemmaIndex = await this.#lemmaIndexMap(listId, cards.some((c) => !c.back));
    const notFound = this.#translate.instant('deck-content.not-found');
    let buffer = '';
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const resolved = c.back
        ? null
        : await this.#cardDefinition.resolve(c.term, c.lang, lemmaIndex.get(`${c.term}:${c.lang}`) ?? 0);
      const line = buildCardContentLine(c.term, c.back, resolved, notFound);
      buffer += `<p class="card-line">${this.#markdown.convertMarkdown(line)}</p>`;

      const last = i + 1 === cards.length;
      if (i + 1 === FIRST_CHUNK || (i + 1) % FIRST_CHUNK === 0 || last) {
        this.html.set(this.#sanitizer.bypassSecurityTrustHtml(buffer));
        this.firstPainted.set(true);
        // Yield so the just-set chunk paints before the next batch resolves.
        if (!last) await new Promise((r) => setTimeout(r));
      }
    }
    this.done.set(true);
  }

  /** Map of `term:lang` -> pinned lemma index for back-less cards (one SRS call).
   * Skipped entirely when the deck has no back-less cards. */
  async #lemmaIndexMap(listId: string, needed: boolean): Promise<Map<string, number>> {
    if (!needed) return new Map();
    const cards = (await firstValueFrom(this.#study.getDueCards(listId, true))) ?? [];
    return new Map(cards.map((c) => [`${c.term}:${c.lang}`, c.lemmaIndex]));
  }

  protected onContentClick(event: MouseEvent): void {
    // A tapped target word opens the lookup with full reading actions except the
    // bookmark (every word here is already a card in this deck, so its toggle would
    // only remove it). The "→" dictionary jump is normal routing — this page stays
    // in the tab stack. The service ignores taps that miss a word.
    this.#wordClickModal.openWithoutBookmark(event);
  }
}
