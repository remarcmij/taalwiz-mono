import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CompiledDict, DictRecord, DictStoreService, transformDict } from './dict-store.service';

export type SyncStatus = 'idle' | 'syncing' | 'done' | 'offline' | 'error';

interface DictManifest {
  version: string;
  files: string[];
}

@Injectable({ providedIn: 'root' })
export class DictSyncService {
  readonly status$ = new BehaviorSubject<SyncStatus>('idle');

  #dictStore = inject(DictStoreService);

  async init(): Promise<void> {
    await this.#dictStore.open();
    await this.syncIfNeeded();
  }

  async syncIfNeeded(): Promise<void> {
    if (this.status$.value === 'syncing') return;
    if (!navigator.onLine) {
      this.status$.next('offline');
      return;
    }

    let manifest: DictManifest;
    try {
      const response = await fetch('/assets/dict-manifest.json');
      if (!response.ok) {
        // 404 = no dict uploaded yet; anything else = server-side problem
        this.status$.next(response.status === 404 ? 'done' : 'error');
        return;
      }
      manifest = (await response.json()) as DictManifest;
    } catch {
      this.status$.next('offline');
      return;
    }

    const storedVersion = await this.#dictStore.getStoredVersion();
    if (storedVersion === manifest.version) {
      this.status$.next('done');
      return;
    }

    this.status$.next('syncing');

    try {
      const allLemmas = await this.#fetchAndTransformFiles(manifest.files);
      await this.#dictStore.replaceAll(allLemmas, manifest.version);
      this.status$.next('done');
    } catch {
      this.status$.next('error');
    }
  }

  async #fetchAndTransformFiles(files: string[]): Promise<DictRecord[]> {
    const results = await Promise.all(
      files.map(async (filename) => {
        const response = await fetch('/assets/' + filename);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${filename}: ${response.status}`);
        }
        const data = (await response.json()) as CompiledDict;
        return transformDict(data);
      }),
    );
    return ([] as DictRecord[]).concat(...results);
  }
}
