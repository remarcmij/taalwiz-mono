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
  // Private subjects so only this service can push state; consumers get read-only
  // observables (below). Exposing the raw BehaviorSubjects would let any consumer
  // call .next() and corrupt sync state.
  #status$ = new BehaviorSubject<SyncStatus>('idle');
  #progress$ = new BehaviorSubject<SyncProgress | null>(null);
  // True when a complete dictionary has been committed to IndexedDB (i.e.
  // `meta.version` is non-null). Drives the search-ready gate without polling
  // the store mid-import — calls to count()/getStoredVersion() during the
  // worker's readwrite tx would block on the IDB lock.
  #hasCompleteDict$ = new BehaviorSubject<boolean>(false);

  readonly status$ = this.#status$.asObservable();
  readonly progress$ = this.#progress$.asObservable();
  readonly hasCompleteDict$ = this.#hasCompleteDict$.asObservable();

  #dictStore = inject(DictStoreService);

  // Both `init()` and `syncIfNeeded()` are called fire-and-forget (`void ...`)
  // from authGuard and AppComponent, so neither may reject: an unhandled
  // rejection is invisible to the user and would leave the dictionary silently
  // stuck at 'idle'. Every failure path below ends at #fail() instead.
  async init(): Promise<void> {
    try {
      await this.#dictStore.open();
      const initialVersion = await this.#dictStore.getStoredVersion();
      this.#hasCompleteDict$.next(initialVersion != null);
    } catch (err) {
      // Opening genuinely can fail: a schema upgrade blocked by another tab, or
      // a browser denying IndexedDB (private mode, storage pressure).
      this.#fail('failed to open IndexedDB', err);
      return;
    }
    await this.syncIfNeeded();
  }

  #fail(message: string, err: unknown): void {
    console.error(`[dict] ${message}`, err);
    this.#status$.next('error');
  }

  async syncIfNeeded(): Promise<void> {
    if (this.#status$.value === 'downloading' || this.#status$.value === 'importing') return;
    if (!navigator.onLine) {
      this.#status$.next('offline');
      return;
    }

    let manifest: DictManifest;
    try {
      const response = await fetch('/assets/dict-manifest.json');
      if (!response.ok) {
        if (response.status === 404) {
          // 404 = no dict uploaded yet.
          this.#status$.next('done');
        } else if (response.status === 504 || !navigator.onLine) {
          // When a service worker controls the page, an offline fetch of the
          // (deliberately un-cached) manifest does not throw — ngsw resolves it
          // with a synthetic 504. So treat a 504, or a falsy navigator.onLine,
          // as offline rather than a server-side error. (The catch below only
          // fires when there is no SW to intercept the failed request.)
          this.#status$.next('offline');
        } else {
          // A reachable server returning a genuine error.
          this.#status$.next('error');
        }
        return;
      }
      manifest = (await response.json()) as DictManifest;
    } catch {
      this.#status$.next('offline');
      return;
    }

    let storedVersion: string | null;
    try {
      storedVersion = await this.#dictStore.getStoredVersion();
    } catch (err) {
      // Reachable when the read connection was closed out from under us by the
      // `blocking` handler in openDictDb (another tab is upgrading the schema).
      this.#fail('failed to read the stored dictionary version', err);
      return;
    }
    if (storedVersion === manifest.version) {
      this.#status$.next('done');
      return;
    }

    // The cheap manifest/version check stays on the main thread; the heavy
    // fetch + transform + ~270k-record IDB write runs in a dedicated worker.
    this.#status$.next('downloading');
    this.#progress$.next({ phase: 'downloading', loaded: 0, total: manifest.files.length });
    const startedAt = performance.now();
    try {
      await this.#runImportInWorker({ files: manifest.files, version: manifest.version });
      this.#hasCompleteDict$.next(true);
      this.#status$.next('done');
      // Wall-clock import time + post-import IDB footprint, so we can track
      // both as the schema and import path evolve.
      const elapsed = ((performance.now() - startedAt) / 1000).toFixed(2);
      const { usage, quota } = await navigator.storage.estimate();
      const mb = (n: number | undefined) =>
        n == null ? '?' : (n / 1024 / 1024).toFixed(1) + ' MB';
      console.log(
        `[dict] import complete in ${elapsed}s — IDB usage ${mb(usage)} (quota ${mb(quota)})`,
      );
    } catch (err) {
      this.#fail('dictionary import failed', err);
    } finally {
      this.#progress$.next(null);
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
            if (msg.phase !== this.#status$.value) {
              this.#status$.next(msg.phase);
            }
            this.#progress$.next({
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
