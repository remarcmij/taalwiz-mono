/// <reference lib="webworker" />

// Off-main-thread dictionary import.
//
// Layout: one atomic readwrite IndexedDB transaction (clear + adds + version)
// runs in this worker, so the main thread never serializes ~270k records and
// IDB isolation guarantees a reader can never see a half-built store.
//
// Crucial invariant: between opening the transaction and `await tx.done`,
// we MUST NOT await any non-IDB promise. Awaiting one (e.g. `fetch`) yields
// control to the event loop, which auto-commits the transaction early and
// would split the import into multiple incomplete commits. All network work
// finishes before the tx opens; progress is reported with synchronous
// `postMessage` calls inside the insert loop — those don't yield.

import {
  CompiledDict,
  ImportMessage,
  ImportRequest,
  openDictDb,
  transformDict,
} from './dict-db';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: ImportMessage): void {
  ctx.postMessage(msg);
}

async function runImport({ files, version }: ImportRequest): Promise<void> {
  // ---- Phase 1: fetch + parse every file (off main thread). ----
  // All awaits happen BEFORE the write tx opens.
  let downloaded = 0;
  const compiled = await Promise.all(
    files.map(async (filename) => {
      const response = await fetch('/assets/' + filename);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${filename}: ${response.status}`);
      }
      const data = (await response.json()) as CompiledDict;
      downloaded += 1;
      post({
        type: 'progress',
        phase: 'downloading',
        loaded: downloaded,
        total: files.length,
      });
      return data;
    }),
  );

  // ---- Phase 2: single atomic transaction. ----
  // The tx stays open across the whole synchronous insert loop because no
  // non-IDB awaits happen. Readers on the main-thread connection see the
  // previous complete dictionary until commit, then atomically the new one.
  const db = await openDictDb();
  const tx = db.transaction(['lemmas', 'meta'], 'readwrite');
  const lemmaStore = tx.objectStore('lemmas');
  lemmaStore.clear();

  let imported = 0;
  for (const data of compiled) {
    let lastReq: Promise<IDBValidKey> | undefined;
    for (const record of transformDict(data)) {
      lastReq = lemmaStore.add(record);
    }
    // Pace progress to actual IDB throughput. Awaiting the file's last
    // `add()` Promise (an IDB request) is safe inside a tx — the next
    // iteration synchronously queues more adds (or after the last file,
    // `meta.put()` runs synchronously) so the tx stays alive. Without this
    // pause we'd post all 52 "imported" messages within milliseconds while
    // tx.done still has hundreds of thousands of records to drain — the
    // chip would jump straight to 52/52 and stall there.
    if (lastReq) await lastReq;
    imported += 1;
    post({
      type: 'progress',
      phase: 'importing',
      loaded: imported,
      total: files.length,
    });
  }

  // Version is written LAST so a crash mid-import leaves no version stamp
  // (or the previous one) — the dictionary is treated as not-ready / stale
  // on the next session and re-imported cleanly.
  tx.objectStore('meta').put({ key: 'version', value: version });
  await tx.done;
}

ctx.onmessage = async (event: MessageEvent<ImportRequest>) => {
  try {
    await runImport(event.data);
    post({ type: 'done' });
  } catch (err) {
    post({ type: 'error', error: err instanceof Error ? err.message : String(err) });
  }
};
