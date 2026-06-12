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
  IonThumbnail,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { helpCircleOutline, refreshOutline } from 'ionicons/icons';

import { TranslatePipe } from '@ngx-translate/core';
import { Subject, filter, switchMap } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { ContentService } from './content.service';

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

  #refresh$ = new Subject<void>();
  topics$ = this.#refresh$.pipe(switchMap(() => this.#contentService.fetchPublications()));

  /** UI language for the help deep-link shown when the library is empty. */
  helpLang = computed(() => this.#authService.user()?.lang ?? 'nl');

  constructor() {
    addIcons({ helpCircleOutline, refreshOutline });
    this.#authService.user$.pipe(
      takeUntilDestroyed(),
      filter(Boolean),
    ).subscribe(() => this.#refresh$.next());
  }

  ionViewWillEnter() {
    this.#refresh$.next();
  }

  handleRefresh(event?: { target: { complete: () => void } }) {
    this.#refresh$.next();
    event?.target.complete();
  }
}
