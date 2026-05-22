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

  #topics$ = this.#route.data.pipe(map(({ topics }) => topics));

  #topics: Signal<ITopic[]> = toSignal(this.#topics$, {
    initialValue: [] as ITopic[],
  });

  topics = computed(() =>
    this.#topics().filter((topic) => topic.type === 'article')
  );

  publicationTitle = computed(
    () =>
      this.#topics().find((topic) => topic.type === 'index')?.title ||
      'Publication'
  );

  cacheStatus = signal<CacheStatus>('idle');
  cachedCount = signal(0);

  constructor() {
    addIcons({ cloudDownloadOutline, checkmarkCircleOutline });
  }

  cacheAll() {
    const articleTopics = this.topics();
    if (articleTopics.length === 0 || this.cacheStatus() === 'caching') return;

    this.cacheStatus.set('caching');
    this.cachedCount.set(0);

    const prefetches = articleTopics.map((t) =>
      this.#contentService.prefetchArticle(t.filename)
    );

    concat(...prefetches)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: () => this.cachedCount.update((n) => n + 1),
        complete: () => this.cacheStatus.set('done'),
      });
  }
}
