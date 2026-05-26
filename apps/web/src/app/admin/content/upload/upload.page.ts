import { DecimalPipe, NgClass } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonProgressBar,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { alertOutline, checkmarkOutline, closeOutline } from 'ionicons/icons';

import { Subscription } from 'rxjs';

import { ContentService } from '../../../home/content/content.service';

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error' | 'cancelled';

interface UploadItem {
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
}

const ACCEPT_PATTERN = /\.(md|json)$/i;

@Component({
  selector: 'app-upload',
  templateUrl: './upload.page.html',
  styleUrls: ['./upload.page.scss'],
  imports: [
    NgClass,
    DecimalPipe,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonProgressBar,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon,
    IonButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadPage {
  #http = inject(HttpClient);
  #alertCtrl = inject(AlertController);
  #contentService = inject(ContentService);

  items = signal<UploadItem[]>([]);
  isDragOver = signal(false);
  isUploading = signal(false);
  progress = computed(() => {
    const items = this.items();
    if (items.length === 0) return 0;
    return items.reduce((sum, it) => sum + it.progress, 0) / items.length;
  });

  #activeSub: Subscription | null = null;
  #cancelRequested = false;

  constructor() {
    addIcons({ checkmarkOutline, alertOutline, closeOutline });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files) this.#addFiles(files);
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) this.#addFiles(input.files);
    input.value = '';
  }

  #addFiles(fileList: FileList) {
    const newItems: UploadItem[] = [];
    for (const file of Array.from(fileList)) {
      if (!ACCEPT_PATTERN.test(file.name)) continue;
      newItems.push({ file, status: 'pending', progress: 0 });
    }
    if (newItems.length > 0) {
      this.items.update((items) => [...items, ...newItems]);
    }
  }

  async uploadAll() {
    if (this.isUploading()) return;
    this.isUploading.set(true);
    this.#cancelRequested = false;
    const errors: string[] = [];

    const snapshot = this.items();
    for (let i = 0; i < snapshot.length; i++) {
      if (this.#cancelRequested) break;
      if (this.items()[i].status !== 'pending') continue;
      const err = await this.#uploadOne(i);
      if (err) errors.push(err);
    }

    this.isUploading.set(false);
    this.#contentService.clearCache();
    await this.#showCompletionAlert(errors);
  }

  #uploadOne(index: number): Promise<string | null> {
    return new Promise((resolve) => {
      const item = this.items()[index];
      const formData = new FormData();
      formData.append('file', item.file);

      this.#patchItem(index, { status: 'uploading', progress: 0 });

      this.#activeSub = this.#http
        .post('/api/v1/content/upload', formData, {
          reportProgress: true,
          observe: 'events',
        })
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              this.#patchItem(index, { progress: event.loaded / event.total });
            } else if (event.type === HttpEventType.Response) {
              this.#patchItem(index, { status: 'success', progress: 1 });
            }
          },
          error: (err) => {
            const msg = err.error?.message ?? err.message ?? 'Unknown error';
            this.#patchItem(index, { status: 'error', error: msg });
            this.#activeSub = null;
            resolve(`${item.file.name}: ${msg}`);
          },
          complete: () => {
            this.#activeSub = null;
            resolve(null);
          },
        });
    });
  }

  #patchItem(index: number, patch: Partial<UploadItem>) {
    this.items.update((items) =>
      items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  cancelAll() {
    this.#cancelRequested = true;
    this.#activeSub?.unsubscribe();
    this.#activeSub = null;
    this.items.update((items) =>
      items.map((it) => (it.status === 'uploading' ? { ...it, status: 'cancelled' } : it)),
    );
    this.isUploading.set(false);
  }

  clearQueue() {
    this.items.set([]);
  }

  async #showCompletionAlert(errors: string[]) {
    const header = errors.length > 0 ? 'Upload complete with errors' : 'Upload complete';
    const message = errors.length > 0 ? errors.join(', ') : 'All files have been uploaded';
    const alertEl = await this.#alertCtrl.create({ header, message, buttons: ['OK'] });
    alertEl.present();
  }
}
