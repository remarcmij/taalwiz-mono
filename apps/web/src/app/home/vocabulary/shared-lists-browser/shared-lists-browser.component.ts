import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronBackOutline, downloadOutline } from 'ionicons/icons';
import { MarkdownService } from '../../content/markdown.service';
import {
  PublicVocabularyList,
  VocabularyEntry,
  VocabularyService,
} from '../vocabulary.service';

@Component({
  selector: 'app-shared-lists-browser',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonSpinner,
    TranslatePipe,
  ],
  templateUrl: './shared-lists-browser.component.html',
  styleUrls: ['./shared-lists-browser.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedListsBrowserComponent {
  #modalCtrl = inject(ModalController);
  #vocabularyService = inject(VocabularyService);
  #toastCtrl = inject(ToastController);
  #translate = inject(TranslateService);
  #markdownService = inject(MarkdownService);

  /** Render a list item's `**bold**`/`*italic*` back markup as plain emphasis for
   * the preview (tinyMarkdown, so no tappable spans — this is a summary row). */
  protected backPreviewHtml(text: string): string {
    return this.#markdownService.tinyMarkdown(text);
  }

  protected loading = signal(true);
  protected lists = signal<PublicVocabularyList[]>([]);

  protected selected = signal<PublicVocabularyList | null>(null);
  protected items = signal<VocabularyEntry[]>([]);
  protected itemsLoading = signal(false);
  protected importing = signal(false);

  /** The deck an import will land in — the active deck, same model as paste. */
  protected currentDeckName = computed(() => this.#vocabularyService.currentList()?.name ?? '');

  constructor() {
    addIcons({ chevronBackOutline, downloadOutline });
  }

  async ionViewWillEnter(): Promise<void> {
    this.lists.set(await this.#vocabularyService.fetchPublicLists());
    this.loading.set(false);
  }

  protected async openPreview(list: PublicVocabularyList): Promise<void> {
    this.selected.set(list);
    this.itemsLoading.set(true);
    this.items.set(await this.#vocabularyService.fetchPublicItems(list.id));
    this.itemsLoading.set(false);
  }

  protected back(): void {
    this.selected.set(null);
    this.items.set([]);
  }

  protected async importList(list: PublicVocabularyList): Promise<void> {
    // Import into the active deck — same active-deck model as paste import. A
    // different/new target is set up the usual way (create the deck, make it
    // active) before opening this browser, so lessons grow one deck rather than
    // spawning a deck per lesson.
    const targetListId = this.#vocabularyService.currentListId();
    if (!targetListId) return;

    this.importing.set(true);
    const items = await this.#vocabularyService.fetchPublicItems(list.id);
    const entries = items.map((i) => ({ term: i.term, back: i.back }));
    const succeeded = await this.#vocabularyService.importEntries(entries, targetListId);
    this.importing.set(false);

    const ok = entries.length > 0 && succeeded === entries.length;
    const toast = await this.#toastCtrl.create({
      message: this.#translate.instant(
        ok ? 'shared-lists.import-success' : 'shared-lists.import-failed',
        { name: list.name },
      ),
      duration: 2500,
      position: 'bottom',
      color: ok ? 'success' : 'danger',
    });
    await toast.present();
    if (ok) await this.#modalCtrl.dismiss({ action: 'imported' });
  }

  protected close(): Promise<boolean> {
    return this.#modalCtrl.dismiss(null);
  }
}
