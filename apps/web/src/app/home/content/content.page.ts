import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonThumbnail,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { helpCircleOutline, refreshOutline } from 'ionicons/icons';

import { TranslatePipe } from '@ngx-translate/core';
import { Subject, filter, map, startWith, switchMap } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { ContentService } from './content.service';
import { type ITopic } from './topic.model';

@Component({
  selector: 'app-content',
  imports: [
    AsyncPipe,
    RouterLink,
    TranslatePipe,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonImg,
    IonItem,
    IonLabel,
    IonList,
    IonMenuButton,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonThumbnail,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './content.page.html',
  styleUrls: ['./content.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentPage {
  #contentService = inject(ContentService);
  #authService = inject(AuthService);

  // Fires whenever the library should reload: on login, on page enter, and on
  // pull-to-refresh. switchMap below cancels any in-flight fetch on re-trigger.
  #refresh$ = new Subject<void>();
  /**
   * View state for the library list. Emits `loading` immediately on each fetch
   * so the template shows a spinner instead of flashing the empty placeholder
   * before the publications arrive.
   */
  vm$ = this.#refresh$.pipe(
    switchMap(() =>
      this.#contentService.fetchPublications().pipe(
        map((topics) => ({ loading: false, topics })),
        startWith({ loading: true, topics: [] as ITopic[] }),
      ),
    ),
  );

  /** UI language for the help deep-link shown when the library is empty. */
  helpLang = computed(() => this.#authService.user()?.lang ?? 'nl');

  constructor() {
    addIcons({ helpCircleOutline, refreshOutline });
    // Reload the library once a user is present (login / auto-login), so the
    // list reflects the newly authenticated user's authorized publications.
    this.#authService.user$.pipe(
      takeUntilDestroyed(),
      filter(Boolean),
    ).subscribe(() => this.#refresh$.next());
  }

  // Refresh on every navigation into this tab (not just first construction),
  // so content uploaded/removed elsewhere shows up when the user returns.
  ionViewWillEnter() {
    this.#refresh$.next();
  }

  // Pull-to-refresh handler. Triggers a reload, then completes the refresher
  // to dismiss its spinner (the arg is optional so it's also callable directly).
  handleRefresh(event?: { target: { complete: () => void } }) {
    this.#refresh$.next();
    event?.target.complete();
  }
}
