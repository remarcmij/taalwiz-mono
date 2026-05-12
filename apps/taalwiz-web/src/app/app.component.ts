import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';

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

import { filter, first, Subject, takeUntil } from 'rxjs';
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
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from './auth/auth.service';
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
  #menuCtrl = inject(MenuController);
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

    App.addListener('appStateChange', this.checkAuthOnResume.bind(this));

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
    document.getElementById(headingId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  reload() {
    document.location.reload();
  }

  private checkAuthOnResume(state: AppState) {
    if (state.isActive) {
      this.#authService
        .autoLogin()
        .pipe(first())
        .subscribe((success) => {
          if (!success) {
            this.onLogout();
          }
        });
    }
  }
}
