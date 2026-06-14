import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
  protected cloning = signal(false);

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

  protected async clone(list: PublicVocabularyList): Promise<void> {
    this.cloning.set(true);
    const cloned = await this.#vocabularyService.cloneList(list.id);
    this.cloning.set(false);
    const toast = await this.#toastCtrl.create({
      message: this.#translate.instant(
        cloned ? 'shared-lists.clone-success' : 'shared-lists.clone-failed',
        { name: list.name },
      ),
      duration: 2500,
      position: 'bottom',
      color: cloned ? 'success' : 'danger',
    });
    await toast.present();
    if (cloned) await this.#modalCtrl.dismiss({ action: 'cloned', listId: cloned.id });
  }

  protected close(): Promise<boolean> {
    return this.#modalCtrl.dismiss(null);
  }
}
