import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterLink } from '@angular/router';

import { App, AppState } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

import { addIcons } from 'ionicons';
import {
  informationCircleOutline,
  logOutOutline,
  mailOutline,
  reloadOutline,
  rocketOutline,
  shieldHalfOutline,
} from 'ionicons/icons';

import { filter, first, pairwise, Subject, takeUntil } from 'rxjs';
import { environment } from '../environments/environment';

import {
  IonApp,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  IonTitle,
  IonToolbar,
  MenuController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from './auth/auth.service';
import { DictSyncService } from './home/dictionary/dict-sync.service';
import { User } from './auth/user.model';
import { TocService } from './home/content/publication/article/toc.service';
import { SpeechSynthesizerService } from './home/speech-synthesizer.service';
import { LoggerService } from './shared/logger.service';
import { PromptUpdateService } from './sw-update/prompt-update.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrl: 'app.component.scss',
  imports: [
    IonApp,
    IonMenu,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonMenuToggle,
    IonIcon,
    RouterLink,
    IonRouterOutlet,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  #router = inject(Router);
  #authService = inject(AuthService);
  #dictSync = inject(DictSyncService);
  #menuCtrl = inject(MenuController);
  #toastCtrl = inject(ToastController);
  #speechService = inject(SpeechSynthesizerService);
  #logger = inject(LoggerService);
  #translate = inject(TranslateService);

  // Injected for its side effect only: Angular constructing the singleton starts
  // the service worker update detection. The field is intentionally never read.
  // ESLint is suppressed below; TypeScript diagnostic 6133 ("declared but its
  // value is never read") will still appear — that is expected and harmless.
  // eslint-disable-next-line no-unused-private-class-members
  #updateService = inject(PromptUpdateService);

  protected tocService = inject(TocService);

  currentUser = signal<User | null>(null);
  #destroy$ = new Subject<void>();

  constructor() {
    addIcons({
      informationCircleOutline,
      shieldHalfOutline,
      mailOutline,
      logOutOutline,
      rocketOutline,
      reloadOutline,
    });
  }

  ngOnInit() {
    const logLevel = environment.production ? 'info' : 'silly';
    this.#logger.setLevel(logLevel);

    this.#translate.use('nl').subscribe(() => {
      // Previous subscribe is needed to ensure the language is set before
      // the user is checked and redirected to the login page if needed.
      this.#authService.user$
        .pipe(takeUntil(this.#destroy$))
        .subscribe((user) => {
          // At app start we may come here twice, once with user null and once
          // with the user set due to auto-resume.
          if (!user && this.currentUser() !== user) {
            this.#router.navigateByUrl('/auth');
          }
          this.currentUser.set(user);
        });
    });

    if (this.#speechService.isSynthesisSupported()) {
      this.#logger.debug('AppComponent', 'speech synthesis is available');
    } else {
      this.#logger.error('AppComponent', 'speech synthesis is NOT available');
    }

    this.#dictSync.status$
      .pipe(
        pairwise(),
        filter(([prev, curr]) => prev === 'syncing' && curr === 'done'),
        takeUntil(this.#destroy$)
      )
      .subscribe(() => {
        void this.#showSyncDoneToast();
      });

    App.addListener('appStateChange', this.checkAuthOnResume.bind(this));

    // Blur the focused element when navigation starts so that Ionic can safely
    // apply aria-hidden to the outgoing page without triggering a browser
    // accessibility warning about aria-hidden ancestors of focused elements.
    this.#router.events
      .pipe(
        takeUntil(this.#destroy$),
        filter((event) => event instanceof NavigationStart)
      )
      .subscribe(() => {
        (document.activeElement as HTMLElement)?.blur();
      });

    // Save last url to preferences so that we can land on the same url
    // after a restart.
    this.#router.events
      .pipe(
        takeUntil(this.#destroy$),
        filter((event) => event instanceof NavigationEnd)
      )
      .subscribe(async (event) => {
        await Preferences.set({ key: 'lastUrl', value: event.url });
      });
  }

  onLogout() {
    this.#authService.logout();
  }

  ngOnDestroy() {
    this.#destroy$.next();
    this.#destroy$.complete();
  }

  async onTocClick(headingId: string) {
    await this.#menuCtrl.close('toc-menu');

    const el = document.getElementById(headingId);
    if (!el) return;

    const ionContent = document.querySelector('#main-content ion-content') as HTMLIonContentElement | null;
    if (!ionContent) {
      el.scrollIntoView({ behavior: 'instant', block: 'start' });
      return;
    }

    const scrollEl = await ionContent.getScrollElement();
    const contentRect = scrollEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetY = scrollEl.scrollTop + elRect.top - contentRect.top;
    await ionContent.scrollToPoint(0, targetY, 200);
  }

  reload() {
    document.location.reload();
  }

  async #showSyncDoneToast() {
    const toast = await this.#toastCtrl.create({
      message: this.#translate.instant('dictionary.sync-done'),
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  }

  private checkAuthOnResume(state: AppState) {
    if (state.isActive) {
      this.#authService
        .autoLogin()
        .pipe(first())
        .subscribe((success) => {
          if (!success) {
            this.onLogout();
          } else {
            void this.#dictSync.syncIfNeeded();
          }
        });
    }
  }
}
