import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DictStoreService } from './dict-store.service';
import { ImportMessage, ImportRequest } from './dict-db';

export type SyncStatus =
  | 'idle'
  | 'downloading'
  | 'importing'
  | 'done'
  | 'offline'
  | 'error';

export interface SyncProgress {
  phase: 'downloading' | 'importing';
  loaded: number;
  total: number;
}

interface DictManifest {
  version: string;
  files: string[];
}

@Injectable({ providedIn: 'root' })
export class DictSyncService {
  readonly status$ = new BehaviorSubject<SyncStatus>('idle');
  readonly progress$ = new BehaviorSubject<SyncProgress | null>(null);
  // True when a complete dictionary has been committed to IndexedDB (i.e.
  // `meta.version` is non-null). Drives the search-ready gate without polling
  // the store mid-import — calls to count()/getStoredVersion() during the
  // worker's readwrite tx would block on the IDB lock.
  readonly hasCompleteDict$ = new BehaviorSubject<boolean>(false);

  #dictStore = inject(DictStoreService);

  async init(): Promise<void> {
    await this.#dictStore.open();
    const initialVersion = await this.#dictStore.getStoredVersion();
    this.hasCompleteDict$.next(initialVersion != null);
    await this.syncIfNeeded();
  }

  async syncIfNeeded(): Promise<void> {
    if (this.status$.value === 'downloading' || this.status$.value === 'importing') return;
    if (!navigator.onLine) {
      this.status$.next('offline');
      return;
    }

    let manifest: DictManifest;
    try {
      const response = await fetch('/assets/dict-manifest.json');
      if (!response.ok) {
        if (response.status === 404) {
          // 404 = no dict uploaded yet.
          this.status$.next('done');
        } else if (response.status === 504 || !navigator.onLine) {
          // When a service worker controls the page, an offline fetch of the
          // (deliberately un-cached) manifest does not throw — ngsw resolves it
          // with a synthetic 504. So treat a 504, or a falsy navigator.onLine,
          // as offline rather than a server-side error. (The catch below only
          // fires when there is no SW to intercept the failed request.)
          this.status$.next('offline');
        } else {
          // A reachable server returning a genuine error.
          this.status$.next('error');
        }
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

    // The cheap manifest/version check stays on the main thread; the heavy
    // fetch + transform + ~270k-record IDB write runs in a dedicated worker.
    this.status$.next('downloading');
    this.progress$.next({ phase: 'downloading', loaded: 0, total: manifest.files.length });
    const startedAt = performance.now();
    try {
      await this.#runImportInWorker({ files: manifest.files, version: manifest.version });
      this.hasCompleteDict$.next(true);
      this.status$.next('done');
      // Wall-clock import time + post-import IDB footprint, so we can track
      // both as the schema and import path evolve.
      const elapsed = ((performance.now() - startedAt) / 1000).toFixed(2);
      const { usage, quota } = await navigator.storage.estimate();
      const mb = (n: number | undefined) =>
        n == null ? '?' : (n / 1024 / 1024).toFixed(1) + ' MB';
      console.log(
        `[dict] import complete in ${elapsed}s — IDB usage ${mb(usage)} (quota ${mb(quota)})`,
      );
    } catch {
      this.status$.next('error');
    } finally {
      this.progress$.next(null);
    }
  }

  #runImportInWorker(request: ImportRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./dict-import.worker', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (event: MessageEvent<ImportMessage>) => {
        const msg = event.data;
        switch (msg.type) {
          case 'progress':
            // Re-emit phase + progress to the UI. The phase flip from
            // 'downloading' to 'importing' is what tells the banner to swap
            // its message ("Downloading…" → "Importing…").
            if (msg.phase !== this.status$.value) {
              this.status$.next(msg.phase);
            }
            this.progress$.next({
              phase: msg.phase,
              loaded: msg.loaded,
              total: msg.total,
            });
            break;
          case 'done':
            worker.terminate();
            resolve();
            break;
          case 'error':
            worker.terminate();
            reject(new Error(msg.error));
            break;
        }
      };

      worker.onerror = (event) => {
        worker.terminate();
        reject(new Error(event.message || 'Worker error'));
      };

      worker.postMessage(request);
    });
  }
}
