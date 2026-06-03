import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router, RouterLink } from '@angular/router';

import { App, AppState } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';

import { addIcons } from 'ionicons';
import {
  cloudDownloadOutline,
  cloudUploadOutline,
  helpCircleOutline,
  informationCircleOutline,
  libraryOutline,
  logOutOutline,
  mailOutline,
  peopleOutline,
  personAddOutline,
  pricetagsOutline,
  refreshOutline,
  reloadOutline,
  settingsOutline,
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
  IonSpinner,
  IonTitle,
  IonToolbar,
  AlertController,
  MenuController,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AboutModalComponent } from './about/about-modal/about-modal.component';
import { AdminService } from './admin/admin.service';
import { AuthService } from './auth/auth.service';
import { DictSyncService, SyncStatus } from './home/dictionary/dict-sync.service';
import { TocService } from './home/content/publication/article/toc.service';
import { SpeechSynthesizerService } from './home/speech-synthesizer.service';
import { LoggerService } from './shared/logger.service';
import { ThemeService } from './shared/theme/theme.service';
import { PromptUpdateService, UPDATE_INSTALLED_FLAG } from './sw-update/prompt-update.service';

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
    IonSpinner,
    RouterLink,
    IonRouterOutlet,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  #router = inject(Router);
  #authService = inject(AuthService);
  #adminService = inject(AdminService);
  #alertCtrl = inject(AlertController);
  #dictSync = inject(DictSyncService);
  #menuCtrl = inject(MenuController);
  #modalCtrl = inject(ModalController);
  #toastCtrl = inject(ToastController);
  #speechService = inject(SpeechSynthesizerService);
  #logger = inject(LoggerService);
  #translate = inject(TranslateService);

  #updateService = inject(PromptUpdateService);

  // Injected for its construction side effect (applies saved theme on startup);
  // intentionally never read.
  // eslint-disable-next-line no-unused-private-class-members
  #themeService = inject(ThemeService);

  protected tocService = inject(TocService);

  readonly currentUser = this.#authService.user;
  protected updateReady = this.#updateService.updateReady;
  // Drives the global "Updating dictionary…" indicator chip. The chip lives in
  // the app shell so it's visible from any tab/route — the on-page banner in
  // the Dictionary tab only surfaces this on first build.
  protected syncStatus = toSignal(this.#dictSync.status$, {
    initialValue: 'idle' as SyncStatus,
  });
  protected syncProgress = toSignal(this.#dictSync.progress$, { initialValue: null });
  protected isSyncing = computed(
    () => this.syncStatus() === 'downloading' || this.syncStatus() === 'importing',
  );
  // Combined 0..100% across both phases. Download is network-bound and quick
  // on Wi-Fi/5G; import is the IDB-write phase and is the bulk of perceived
  // time. Weight 10/90 so the bar mostly reflects the actual write progress.
  protected syncPercent = computed(() => {
    const p = this.syncProgress();
    if (!p || p.total === 0) return 0;
    const frac = Math.min(1, p.loaded / p.total);
    return p.phase === 'downloading'
      ? Math.round(frac * 10)
      : Math.round(10 + frac * 90);
  });
  #destroy$ = new Subject<void>();

  constructor() {
    addIcons({
      cloudDownloadOutline,
      helpCircleOutline,
      informationCircleOutline,
      shieldHalfOutline,
      mailOutline,
      logOutOutline,
      reloadOutline,
      settingsOutline,
      personAddOutline,
      libraryOutline,
      peopleOutline,
      cloudUploadOutline,
      refreshOutline,
      pricetagsOutline,
    });
  }

  ngOnInit() {
    const logLevel = environment.production ? 'info' : 'silly';
    this.#logger.setLevel(logLevel);

    if (sessionStorage.getItem(UPDATE_INSTALLED_FLAG) === '1') {
      sessionStorage.removeItem(UPDATE_INSTALLED_FLAG);
      void this.#showUpdateInstalledToast();
    }

    this.#authService.user$
      .pipe(
        pairwise(),
        filter(([prev, curr]) => prev !== null && curr === null),
        takeUntil(this.#destroy$),
      )
      .subscribe(() => {
        this.#router.navigateByUrl('/auth');
      });

    if (this.#speechService.isSynthesisSupported()) {
      this.#logger.debug('AppComponent', 'speech synthesis is available');
    } else {
      this.#logger.error('AppComponent', 'speech synthesis is NOT available');
    }

    this.#dictSync.status$
      .pipe(
        pairwise(),
        filter(([prev, curr]) => prev === 'importing' && curr === 'done'),
        takeUntil(this.#destroy$),
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
        filter((event) => event instanceof NavigationStart),
      )
      .subscribe(() => {
        (document.activeElement as HTMLElement)?.blur();
      });

    // Save last url to preferences so that we can land on the same url
    // after a restart.
    this.#router.events
      .pipe(
        takeUntil(this.#destroy$),
        filter((event) => event instanceof NavigationEnd),
      )
      .subscribe(async (event) => {
        await Preferences.set({ key: 'lastUrl', value: event.url });
      });
  }

  onLogout() {
    this.#authService.logout();
  }

  goToDictionary() {
    void this.#router.navigateByUrl('/home/tabs/dictionary');
  }

  async openAbout() {
    const modal = await this.#modalCtrl.create({ component: AboutModalComponent });
    await modal.present();
  }

  ngOnDestroy() {
    this.#destroy$.next();
    this.#destroy$.complete();
  }

  async onTocClick(headingId: string) {
    await this.#menuCtrl.close('toc-menu');
    document.getElementById(headingId)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  reload() {
    document.location.reload();
  }

  applyUpdate() {
    this.#updateService.applyUpdate();
  }

  reprocessHashtags() {
    this.#adminService.reprocessHashtags().subscribe({
      next: async () => {
        const alert = await this.#alertCtrl.create({
          header: 'Done',
          message: 'Hashtags reprocessed successfully.',
          buttons: ['OK'],
        });
        await alert.present();
      },
      error: async (err) => {
        const alert = await this.#alertCtrl.create({
          header: 'Error',
          message: err?.error?.message ?? 'Reprocess failed.',
          buttons: ['OK'],
        });
        await alert.present();
      },
    });
  }

  async #showSyncDoneToast() {
    const toast = await this.#toastCtrl.create({
      message: this.#translate.instant('dictionary.sync-done'),
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  }

  async #showUpdateInstalledToast() {
    const toast = await this.#toastCtrl.create({
      message: this.#translate.instant('update.update-installed'),
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
