import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
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
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { MarkdownService } from '../../content/markdown.service';
import { DictionaryService } from '../../dictionary/dictionary.service';
import { ILemma } from '../../dictionary/lemma/lemma.model';
import { StudyService } from '../../study/study.service';

/**
 * Picks which dictionary line a back-less SRS card uses as its study answer.
 * Writing the choice (`lemmaIndex`) is study state, so it is allowed even when
 * the list is locked; typing a custom back is not, hence the unlock hint.
 */
@Component({
  selector: 'app-dictionary-line-picker',
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
    IonIcon,
    IonNote,
    IonSpinner,
    TranslatePipe,
  ],
  templateUrl: './dictionary-line-picker.component.html',
  styleUrls: ['./dictionary-line-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DictionaryLinePickerComponent implements OnInit {
  term = input.required<string>();
  lang = input.required<string>();
  listId = input.required<string>();
  locked = input<boolean>(false);

  #modalCtrl = inject(ModalController);
  #dictionary = inject(DictionaryService);
  #study = inject(StudyService);
  #markdown = inject(MarkdownService);

  /** Render the line's `**bold**`/`*italic*` markup as plain emphasis (no tappable
   * spans), matching the vocabulary list's back preview. */
  protected lineHtml(text: string): string {
    return this.#markdown.tinyMarkdown(text);
  }

  protected readonly loading = signal(true);
  protected readonly lemmas = signal<ILemma[]>([]);
  protected readonly currentIndex = signal(0);

  constructor() {
    addIcons({ checkmarkOutline, closeOutline });
  }

  async ngOnInit(): Promise<void> {
    const [result, index] = await Promise.all([
      firstValueFrom(this.#dictionary.fetchWordLemmas(this.term(), this.lang())),
      firstValueFrom(this.#study.getLemmaIndex(this.term(), this.lang(), this.listId())),
    ]);
    this.lemmas.set(result.lemmas);
    this.currentIndex.set(index);
    this.loading.set(false);
  }

  protected async select(index: number): Promise<void> {
    this.#study.setLemmaIndex(this.term(), this.lang(), this.listId(), index).subscribe();
    await this.#modalCtrl.dismiss({ action: 'picked' });
  }

  /** Unlocked-only escape hatch: close the picker and let the caller open the
   * text editor so the user can type a custom answer instead. */
  protected typeInstead(): Promise<boolean> {
    return this.#modalCtrl.dismiss({ action: 'type' });
  }

  protected close(): Promise<boolean> {
    return this.#modalCtrl.dismiss(null);
  }
}
