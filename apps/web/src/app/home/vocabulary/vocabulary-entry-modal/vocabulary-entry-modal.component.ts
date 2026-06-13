import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
  Platform,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { VocabularyEntry, VocabularyService } from '../vocabulary.service';
import { splitImportLine } from './import-line-parser';

@Component({
  selector: 'app-vocabulary-entry-modal',
  imports: [
    IonHeader,
    IonFooter,
    IonToolbar,
    IonButtons,
    IonButton,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonItem,
    IonInput,
    IonTextarea,
    IonNote,
    IonSpinner,
    TranslatePipe,
  ],
  templateUrl: './vocabulary-entry-modal.component.html',
  styleUrls: ['./vocabulary-entry-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyEntryModalComponent {
  mode = input<'add' | 'edit'>('add');
  existingEntry = input<VocabularyEntry | null>(null);

  @ViewChild(IonInput) private termInput?: IonInput;
  @ViewChild(IonTextarea) private csvTextarea?: IonTextarea;

  #modalCtrl = inject(ModalController);
  #vocabularyService = inject(VocabularyService);

  protected isDesktop = inject(Platform).is('desktop');

  protected activeTab = signal<'single' | 'import'>('single');
  protected term = signal('');
  protected back = signal('');
  protected csvText = signal('');
  protected importing = signal(false);

  protected isEditMode = computed(() => this.mode() === 'edit');

  protected canSubmitSingle = computed(() =>
    this.isEditMode() ? true : this.term().trim().length > 0,
  );

  protected parsedEntries = computed(() =>
    this.csvText()
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))
      .map((l) => splitImportLine(l))
      .filter((e) => e.term.length > 0),
  );

  protected invalidLineCount = computed(() => {
    const nonEmpty = this.csvText()
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    return nonEmpty.length - this.parsedEntries().length;
  });

  protected termOnlyCount = computed(() => this.parsedEntries().filter((e) => !e.back).length);

  protected hasNewline = computed(() => this.csvText().includes('\n'));

  constructor() {
    effect(() => {
      const entry = this.existingEntry();
      if (entry) {
        this.term.set(entry.term);
        this.back.set(entry.back ?? '');
      }
    });
  }

  ionViewDidEnter(): void {
    if (this.isDesktop) {
      void this.termInput?.setFocus();
    }
  }

  protected setActiveTab(value: string | number | undefined): void {
    this.activeTab.set(value === 'import' ? 'import' : 'single');
    if (this.isDesktop) {
      setTimeout(() => {
        if (this.activeTab() === 'import') {
          void this.csvTextarea?.setFocus();
        } else {
          void this.termInput?.setFocus();
        }
      }, 100);
    }
  }

  protected async submitSingle(): Promise<void> {
    const term = this.term().trim();
    const back = this.back().trim() || undefined;
    if (this.isEditMode()) {
      const entry = this.existingEntry()!;
      this.#vocabularyService.updateBack(entry.term, entry.lang, back ?? '');
    } else {
      this.#vocabularyService.addEntry(term, back);
    }
    await this.#modalCtrl.dismiss({ action: 'saved' });
  }

  protected async submitImport(): Promise<void> {
    const entries = this.parsedEntries();
    if (entries.length === 0) return;
    this.importing.set(true);
    await this.#vocabularyService.addEntries(entries);
    this.importing.set(false);
    await this.#modalCtrl.dismiss({ action: 'imported' });
  }

  protected close(): Promise<boolean> {
    return this.#modalCtrl.dismiss(null);
  }
}
