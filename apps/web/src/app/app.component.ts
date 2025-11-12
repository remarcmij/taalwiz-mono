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

// import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from './auth/auth.service';
import { User } from './auth/user.model';
import { SpeechSynthesizerService } from './home/speech-synthesizer.service';
import { LoggerService } from './shared/logger.service';
import { PromptUpdateService } from './sw-update/prompt-update.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
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
    // TranslateModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  #router = inject(Router);
  // #translate = inject(TranslateService);
  #authService = inject(AuthService);
  #speechService = inject(SpeechSynthesizerService);
  #logger = inject(LoggerService);
  #translate = inject(TranslateService);

  // Inject the PromptUpdateService - this will trigger the service to start
  #updateService = inject(PromptUpdateService);

  currentUser = signal<User | null>(null);
  #destroy$ = new Subject<void>();

  constructor() {
    // this.#translate.setDefaultLang('en');
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
