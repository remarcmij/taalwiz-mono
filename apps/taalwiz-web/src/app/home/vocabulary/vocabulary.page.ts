import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
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
  IonTitle,
  IonToolbar,
  ModalController,
  Platform,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline, createOutline, pencilOutline, schoolOutline, trashOutline } from 'ionicons/icons';
import { DictionaryService } from '../dictionary/dictionary.service';
import { WordLang } from '../dictionary/word-lang.model';
import { StudyModalComponent } from '../study/study-modal/study-modal.component';
import { StudyService } from '../study/study.service';
import { VocabularyEntryModalComponent } from './vocabulary-entry-modal/vocabulary-entry-modal.component';
import { VocabularyEntry, VocabularyList, VocabularyService } from './vocabulary.service';

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
    IonChip,
    IonIcon,
    TranslatePipe,
  ],
  templateUrl: './vocabulary.page.html',
  styleUrls: ['./vocabulary.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyPage {
  protected vocabularyService = inject(VocabularyService);
  #studyService = inject(StudyService);
  #dictionaryService = inject(DictionaryService);
  #router = inject(Router);
  #alertCtrl = inject(AlertController);
  #modalCtrl = inject(ModalController);
  #translate = inject(TranslateService);
  #platform = inject(Platform);

  protected isDesktop = this.#platform.is('desktop');

  protected dueForCurrentList = computed(() => {
    const listId = this.vocabularyService.currentListId();
    if (!listId) return 0;
    return this.#studyService.stats().find((s: { listId: string; due: number }) => s.listId === listId)?.due ?? 0;
  });

  constructor() {
    addIcons({ addOutline, closeOutline, createOutline, pencilOutline, schoolOutline, trashOutline });
  }

  lookup(entry: VocabularyEntry): void {
    this.#router.navigate(['home/tabs/dictionary']);
    this.#dictionaryService.lookup(new WordLang(entry.term, entry.lang));
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
        ? this.#translate.instant('bookmarks.delete-list-message', { name: list.name, count: list.count })
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
