import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
  pencilOutline,
  peopleOutline,
  schoolOutline,
  trashOutline,
} from 'ionicons/icons';
import { MarkdownService } from '../content/markdown.service';
import { DictionaryService } from '../dictionary/dictionary.service';
import { WordLang } from '../dictionary/word-lang.model';
import { StudyModalComponent } from '../study/study-modal/study-modal.component';
import { StudyService } from '../study/study.service';
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

  /** Render a card back's `**bold**`/`*italic*` markup for the list preview as
   * plain emphasis. Uses `tinyMarkdown` (not `convertMarkdown`) so preview words
   * are NOT wrapped in tappable spans — this row is a summary, not a lookup. */
  protected backPreviewHtml(text: string): string {
    return this.#markdownService.tinyMarkdown(text);
  }

  protected dueForCurrentList = computed(() => {
    const listId = this.vocabularyService.currentListId();
    if (!listId) return 0;
    return (
      this.#studyService.stats().find((s: { listId: string; due: number }) => s.listId === listId)
        ?.due ?? 0
    );
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
      pencilOutline,
      peopleOutline,
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

  /**
   * Per-list overflow menu — rename / delete. Public/private is toggled directly
   * via the globe button on the list, so it is intentionally not repeated here.
   */
  async openListMenu(list: VocabularyList): Promise<void> {
    const sheet = await this.#actionSheetCtrl.create({
      header: list.name,
      buttons: [
        {
          text: this.#translate.instant('bookmarks.rename-list-title'),
          icon: 'pencil-outline',
          handler: () => void this.openRenameListAlert(list),
        },
        {
          text: this.#translate.instant('bookmarks.delete-list-title'),
          icon: 'trash-outline',
          role: 'destructive',
          handler: () => void this.confirmDeleteList(list),
        },
        { text: this.#translate.instant('common.close'), role: 'cancel' },
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
    // (Copies already cloned are unaffected — they are independent.)
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
    if (entry.back) {
      await this.openEditModal(entry);
    } else {
      this.#router.navigate(['home/tabs/dictionary']);
      this.#dictionaryService.lookup(new WordLang(entry.term, entry.lang));
    }
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
  }

  async openAddEntryModal(): Promise<void> {
    if (!this.vocabularyService.currentListId()) return;
    const modal = await this.#modalCtrl.create({
      component: VocabularyEntryModalComponent,
      componentProps: { mode: 'add' },
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
