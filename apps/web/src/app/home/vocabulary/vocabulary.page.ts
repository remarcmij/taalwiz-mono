import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonPopover,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
  Platform,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  addOutline,
  checkmarkOutline,
  chevronDownOutline,
  createOutline,
  ellipsisVertical,
  globe,
  globeOutline,
  lockClosed,
  lockOpenOutline,
  pencilOutline,
  peopleOutline,
  readerOutline,
  schoolOutline,
  trashOutline,
} from 'ionicons/icons';
import { MarkdownService } from '../content/markdown.service';
import { DictionaryService } from '../dictionary/dictionary.service';
import { WordLang } from '../dictionary/word-lang.model';
import { StudyModalComponent } from '../study/study-modal/study-modal.component';
import { StudyService } from '../study/study.service';
import { DictionaryLinePickerComponent } from './dictionary-line-picker/dictionary-line-picker.component';
import { SharedListsBrowserComponent } from './shared-lists-browser/shared-lists-browser.component';
import { VocabularyEntryModalComponent } from './vocabulary-entry-modal/vocabulary-entry-modal.component';
import { VocabularyEntry, VocabularyList, VocabularyService } from './vocabulary.service';
import { PointerService } from '../../shared/pointer.service';

@Component({
  selector: 'app-bookmarks',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonList,
    IonItemSliding,
    IonItem,
    IonLabel,
    IonNote,
    IonBadge,
    IonItemOptions,
    IonItemOption,
    IonButton,
    IonPopover,
    IonIcon,
    IonSpinner,
    TranslatePipe,
  ],
  templateUrl: './vocabulary.page.html',
  styleUrls: ['./vocabulary.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyPage {
  protected vocabularyService = inject(VocabularyService);
  protected pointer = inject(PointerService);
  #studyService = inject(StudyService);
  #dictionaryService = inject(DictionaryService);
  #markdownService = inject(MarkdownService);
  #router = inject(Router);
  #alertCtrl = inject(AlertController);
  #actionSheetCtrl = inject(ActionSheetController);
  #modalCtrl = inject(ModalController);
  #translate = inject(TranslateService);
  #platform = inject(Platform);

  protected isDesktop = this.#platform.is('desktop');

  @ViewChild(IonContent) private content?: IonContent;
  readonly #host = inject(ElementRef);

  /** Render a card back's `**bold**`/`*italic*` markup for the list preview as
   * plain emphasis. Uses `tinyMarkdown` (not `convertMarkdown`) so preview words
   * are NOT wrapped in tappable spans — this row is a summary, not a lookup. */
  protected backPreviewHtml(text: string): string {
    return this.#markdownService.tinyMarkdown(text);
  }

  protected dueForCurrentList = computed(() => {
    const listId = this.vocabularyService.currentListId();
    if (!listId) return 0;
    // `available` (not raw `due`) so the badge reflects what a session will actually
    // serve under the daily new-card cap, not the full unstudied backlog.
    return this.#studyService.stats().find((s) => s.listId === listId)?.available ?? 0;
  });

  constructor() {
    addIcons({
      addOutline,
      checkmarkOutline,
      chevronDownOutline,
      createOutline,
      ellipsisVertical,
      globe,
      globeOutline,
      lockClosed,
      lockOpenOutline,
      pencilOutline,
      peopleOutline,
      readerOutline,
      schoolOutline,
      trashOutline,
    });
  }

  /**
   * Drop focus off the active control before an overlay applies aria-hidden to
   * the background page, otherwise the browser warns about an aria-hidden
   * ancestor of a focused element. Same idiom as the navigation handler in
   * app.component.ts, but pierces shadow roots: ion-button focuses an inner
   * `button.button-native`, and document.activeElement only reports the host.
   */
  protected blurActiveElement(): void {
    let el = document.activeElement as (HTMLElement & { shadowRoot?: ShadowRoot }) | null;
    while (el?.shadowRoot?.activeElement) {
      el = el.shadowRoot.activeElement as HTMLElement & { shadowRoot?: ShadowRoot };
    }
    el?.blur();
  }

  /**
   * Open the per-list menu from a dropdown row: dismiss the popover first (and
   * await it, so its focus-restoration to the trigger completes) before the
   * action sheet presents — otherwise the restored focus trips the aria-hidden
   * warning.
   */
  protected async openListMenuFromRow(list: VocabularyList, popover: IonPopover): Promise<void> {
    await popover.dismiss();
    await this.openListMenu(list);
  }

  async openSharedListsBrowser(): Promise<void> {
    const modal = await this.#modalCtrl.create({ component: SharedListsBrowserComponent });
    await modal.present();
  }

  /** Read the active deck as a content article (tappable words, decomposition).
   * A routed page (not a modal) so it behaves like a Library article. */
  openDeckContent(): void {
    if (!this.vocabularyService.currentListId()) return;
    void this.#router.navigate(['home/tabs/bookmarks/content']);
  }

  /**
   * Per-list overflow menu. `full` (the active deck's toolbar ⋮) prepends the
   * deck-scoped actions that no longer have their own toolbar button — add entry,
   * lock/unlock, share/make-private. The popover-row ⋮ (`full` omitted) keeps the
   * minimal rename / delete set, since those rows carry their own lock/share
   * quick-toggles and "add entry" only ever targets the active deck.
   */
  async openListMenu(list: VocabularyList, full = false): Promise<void> {
    const t = (key: string) => this.#translate.instant(key);
    const deckActions = full
      ? [
          {
            text: t('vocabulary.add-entry'),
            icon: 'create-outline',
            handler: () => void this.openAddEntryModal(),
          },
          {
            text: t(list.isLocked ? 'vocabulary.unlock-list' : 'vocabulary.lock-list'),
            icon: list.isLocked ? 'lock-open-outline' : 'lock-closed',
            handler: () => this.vocabularyService.setListLocked(list.id, !list.isLocked),
          },
          {
            text: t(list.isPublic ? 'shared-lists.make-private' : 'shared-lists.share-list'),
            icon: list.isPublic ? 'globe-outline' : 'globe',
            handler: () => void this.toggleListPublic(list),
          },
        ]
      : [];
    const sheet = await this.#actionSheetCtrl.create({
      // Card count lives here, in the sheet title, rather than the toolbar
      // selector where it took scarce horizontal space for a secondary detail.
      header: `${list.name} (${list.count})`,
      buttons: [
        ...deckActions,
        {
          text: t('bookmarks.rename-list-title'),
          icon: 'pencil-outline',
          handler: () => void this.openRenameListAlert(list),
        },
        {
          text: t('bookmarks.delete-list-title'),
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => void this.confirmDeleteList(list),
        },
        { text: t('common.close'), role: 'cancel' },
      ],
    });
    this.blurActiveElement(); // drop focus off the ⋮ button before aria-hidden is applied
    await sheet.present();
  }

  async toggleListPublic(list: VocabularyList): Promise<void> {
    if (!list.isPublic) {
      this.vocabularyService.setListPublic(list.id, true);
      return;
    }
    // Making a public list private: confirm, since others may want to keep finding it.
    // (Decks others already imported from it are unaffected — they are independent.)
    const alert = await this.#alertCtrl.create({
      header: this.#translate.instant('shared-lists.unpublish-title'),
      message: this.#translate.instant('shared-lists.unpublish-message', { name: list.name }),
      buttons: [
        { text: this.#translate.instant('common.close'), role: 'cancel' },
        {
          text: this.#translate.instant('shared-lists.make-private'),
          handler: () => this.vocabularyService.setListPublic(list.id, false),
        },
      ],
    });
    // The globe may be tapped from inside the open list popover; blur it so the
    // confirm alert can apply aria-hidden without the focused-ancestor warning.
    this.blurActiveElement();
    await alert.present();
  }

  async lookup(entry: VocabularyEntry): Promise<void> {
    // On a locked list, tapping a row is read-only: jump to the dictionary
    // rather than opening the (would-be-rejected) edit modal.
    if (entry.back && !this.vocabularyService.currentListLocked()) {
      await this.openEditModal(entry);
    } else if (this.#isSingleWordTerm(entry.term)) {
      // Only jump to the dictionary for single-word terms. The dictionary is
      // single-headword, so a multi-word phrase (e.g. "sama dengan") can never
      // match and would dead-end on an empty result. Its translation is already
      // shown inline via the card's back, so suppress the search instead.
      this.#router.navigate(['home/tabs/dictionary']);
      this.#dictionaryService.lookup(new WordLang(entry.term, entry.lang));
    }
  }

  // Whether tapping the row does anything: opens the editor (own, unlocked card
  // with a back) or looks the term up in the dictionary (single word). A phrase
  // on a locked/back-only card has no action, so its row drops the `button`
  // affordance rather than rippling to no effect.
  hasTapAction(entry: VocabularyEntry): boolean {
    if (entry.back && !this.vocabularyService.currentListLocked()) {
      return true;
    }
    return this.#isSingleWordTerm(entry.term);
  }

  #isSingleWordTerm(term: string): boolean {
    return !/\s/.test(term.trim());
  }

  relativeTime(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return '< 1m';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  }

  async openStudyModal(): Promise<void> {
    const listId = this.vocabularyService.currentListId();
    if (!listId) return;
    const modal = await this.#modalCtrl.create({
      component: StudyModalComponent,
      componentProps: { defaultListId: listId },
    });
    await modal.present();
    // On exit, scroll the list to the last card shown so the user can jump
    // straight to a card whose dictionary line they want to change.
    const { data } = await modal.onWillDismiss<{ term: string; lang: string } | null>();
    if (data) this.#scrollToCard(data.term, data.lang);
  }

  #scrollToCard(term: string, lang: string): void {
    const key = `${term}:${lang}`;
    // Defer so the list has settled after the modal teardown before scrolling.
    setTimeout(async () => {
      const row = this.#host.nativeElement.querySelector(
        `ion-item-sliding[data-card-key="${CSS.escape(key)}"]`,
      ) as HTMLElement | null;
      const content = this.content;
      if (!row || !content) return;
      const scrollEl = await content.getScrollElement();
      // The content is fullscreen (scrolls behind the header), so align the row's
      // top to just below the header rather than to y=0. Jump instantly — a smooth
      // animation across a 1000+ item list is slow and distracting.
      const headerHeight =
        (this.#host.nativeElement.querySelector('ion-header') as HTMLElement | null)?.offsetHeight ??
        0;
      const top = scrollEl.scrollTop + row.getBoundingClientRect().top - headerHeight;
      scrollEl.scrollTo({ top, behavior: 'instant' });
    });
  }

  /**
   * Edit a card from the list. Routes by (locked, has-back): a card with a back
   * opens the text editor (or, when locked, just reports the lock); a back-less
   * card opens the dictionary-line picker, which works even on a locked list
   * because the chosen line is personal study state, not list content.
   */
  async editCard(entry: VocabularyEntry): Promise<void> {
    const locked = this.vocabularyService.currentListLocked();
    if (entry.back) {
      if (locked) await this.#showListLockedAlert();
      else await this.openEditModal(entry);
      return;
    }
    const modal = await this.#modalCtrl.create({
      component: DictionaryLinePickerComponent,
      componentProps: { term: entry.term, lang: entry.lang, listId: entry.listId, locked },
    });
    await modal.present();
    // Unlocked picker offers "type a custom answer instead" → fall through to the editor.
    const { data } = await modal.onWillDismiss<{ action?: 'type' }>();
    if (data?.action === 'type') await this.openEditModal(entry);
  }

  async #showListLockedAlert(): Promise<void> {
    const name = this.vocabularyService.currentList()?.name ?? '';
    const alert = await this.#alertCtrl.create({
      header: this.#translate.instant('vocabulary.locked'),
      message: this.#translate.instant('vocabulary.list-locked', { name }),
      buttons: [{ text: this.#translate.instant('common.close'), role: 'cancel' }],
    });
    this.blurActiveElement();
    await alert.present();
  }

  async openAddEntryModal(): Promise<void> {
    if (!this.vocabularyService.currentListId()) return;
    // A locked current deck disables only the single-add tab inside the modal
    // (that is the incidental per-word edit the lock guards); import is a
    // deliberate act that picks its own target, so it stays available.
    const modal = await this.#modalCtrl.create({
      component: VocabularyEntryModalComponent,
      componentProps: { mode: 'add', currentLocked: this.vocabularyService.currentListLocked() },
    });
    await modal.present();
  }

  async openEditModal(entry: VocabularyEntry): Promise<void> {
    const modal = await this.#modalCtrl.create({
      component: VocabularyEntryModalComponent,
      componentProps: { mode: 'edit', existingEntry: entry },
    });
    await modal.present();
  }

  async openCreateListAlert(): Promise<void> {
    const alert = await this.#alertCtrl.create({
      header: this.#translate.instant('bookmarks.create-list'),
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: this.#translate.instant('bookmarks.list-name-placeholder'),
        },
      ],
      buttons: [
        { text: this.#translate.instant('common.close'), role: 'cancel' },
        {
          text: this.#translate.instant('common.ok'),
          handler: (data: { name: string }) => {
            const name = data.name?.trim();
            if (!name) return false;
            this.vocabularyService.createList(name);
            return true;
          },
        },
      ],
    });
    await alert.present();
    (document.querySelector('ion-alert input') as HTMLInputElement | null)?.focus();
  }

  async confirmDeleteList(list: VocabularyList): Promise<void> {
    const message =
      list.count > 0
        ? this.#translate.instant('bookmarks.delete-list-message', {
            name: list.name,
            count: list.count,
          })
        : this.#translate.instant('bookmarks.delete-empty-list-message', { name: list.name });

    const alert = await this.#alertCtrl.create({
      header: this.#translate.instant('bookmarks.delete-list-title'),
      message,
      buttons: [
        { text: this.#translate.instant('common.close'), role: 'cancel' },
        {
          text: this.#translate.instant('common.remove'),
          role: 'destructive',
          handler: () => this.vocabularyService.deleteList(list.id),
        },
      ],
    });
    this.blurActiveElement();
    await alert.present();
  }

  async openRenameListAlert(list: VocabularyList): Promise<void> {
    const alert = await this.#alertCtrl.create({
      header: this.#translate.instant('bookmarks.rename-list-title'),
      inputs: [
        {
          name: 'name',
          type: 'text',
          value: list.name,
          placeholder: this.#translate.instant('bookmarks.list-name-placeholder'),
        },
      ],
      buttons: [
        { text: this.#translate.instant('common.close'), role: 'cancel' },
        {
          text: this.#translate.instant('common.ok'),
          handler: (data: { name: string }) => {
            const name = data.name?.trim();
            if (!name || name === list.name) return false;
            this.vocabularyService.renameList(list.id, name);
            return true;
          },
        },
      ],
    });
    await alert.present();
    (document.querySelector('ion-alert input') as HTMLInputElement | null)?.focus();
  }
}
