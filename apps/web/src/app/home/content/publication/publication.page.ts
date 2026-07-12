import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Signal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonProgressBar,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, cloudDownloadOutline } from 'ionicons/icons';

import { concat } from 'rxjs';
import { map } from 'rxjs/operators';

import { BackButtonComponent } from '../../../shared/back-button/back-button.component';
import { ContentService } from '../content.service';
import { type ITopic } from '../topic.model';

// State of the "download all articles for offline use" action:
// idle (not started), caching (prefetch in progress), done (all cached).
type CacheStatus = 'idle' | 'caching' | 'done';

@Component({
  selector: 'app-publication',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonProgressBar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    RouterLink,
    BackButtonComponent,
  ],
  templateUrl: './publication.page.html',
  styleUrls: ['./publication.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicationPage {
  #route = inject(ActivatedRoute);
  #contentService = inject(ContentService);
  #destroyRef = inject(DestroyRef);

  // Topics come pre-resolved by the route resolver (no in-component fetch),
  // exposed as a signal so the template reacts to them.
  #topics$ = this.#route.data.pipe(map(({ topics }) => topics));

  #topics: Signal<ITopic[]> = toSignal(this.#topics$, {
    initialValue: [] as ITopic[],
  });

  // The rows to render: articles plus the manifest (which carries the
  // publication's own intro/metadata). Other topic types are filtered out.
  topics = computed(() =>
    this.#topics().filter((topic) => topic.type === 'article' || topic.type === 'manifest'),
  );

  // Header title taken from the manifest topic, with a fallback for the brief
  // window before topics resolve.
  publicationTitle = computed(
    () => this.#topics().find((topic) => topic.type === 'manifest')?.title || 'Publication',
  );

  // Drives the offline-download button and its progress bar.
  cacheStatus = signal<CacheStatus>('idle');
  cachedCount = signal(0);

  constructor() {
    addIcons({ cloudDownloadOutline, checkmarkCircleOutline });
  }

  // Downloads every article in this publication into the SW cache for offline
  // reading. Prefetches run sequentially (concat, not merge) to avoid a burst
  // of parallel requests; cachedCount ticks up per completed article to feed
  // the progress bar. Guards against re-entry while a run is already in flight.
  cacheAll() {
    const articleTopics = this.topics();
    if (articleTopics.length === 0 || this.cacheStatus() === 'caching') return;

    this.cacheStatus.set('caching');
    this.cachedCount.set(0);

    const prefetches = articleTopics.map((t) => this.#contentService.prefetchArticle(t.filename));

    concat(...prefetches)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => this.cachedCount.update((n) => n + 1),
        complete: () => this.cacheStatus.set('done'),
      });
  }
}
