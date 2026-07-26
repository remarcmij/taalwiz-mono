import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBreadcrumb,
  IonBreadcrumbs,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonItem,
  IonList,
  IonMenuButton,
  IonProgressBar,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  ModalController,
  Platform,
} from '@ionic/angular/standalone';

import {
  Observable,
  Subject,
  catchError,
  filter,
  fromEvent,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';

import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { langConfig } from '../../app.constants';
import { WordClickModalService } from '../../shared/word-click-modal/word-click-modal.service';
import { DictSyncService, SyncStatus } from './dict-sync.service';
import { DictionaryService, LookupGroup, LookupResult } from './dictionary.service';
import { HistoryModalComponent } from './history-modal/history-modal.component';
import { LemmaComponent } from './lemma/lemma.component';
import { lemmaVisibleAt, type DetailLevel } from './lemma/lemma.model';
import { SearchHistoryService } from './search-history.service';
import { SearchbarDropdownComponent } from './searchbar-dropdown/searchbar-dropdown.component';
import { WordLang } from './word-lang.model';

const MAX_RECENT_SEARCHES = 3;

@Component({
  selector: 'app-dictionary',
  imports: [
    NgClass,
    FormsModule,
    SearchbarDropdownComponent,
    LemmaComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonProgressBar,
    IonSearchbar,
    IonContent,
    IonBreadcrumbs,
    IonBreadcrumb,
    IonList,
    IonItem,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    TranslatePipe,
  ],
  templateUrl: './dictionary.page.html',
  styleUrls: ['./dictionary.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DictionaryPage implements OnDestroy {
  #dictionaryService = inject(DictionaryService);
  #wordClickModalService = inject(WordClickModalService);
  #historyService = inject(SearchHistoryService);
  #modalCtrl = inject(ModalController);
  #platform = inject(Platform);
  #dictSync = inject(DictSyncService);
  protected syncStatus = toSignal(this.#dictSync.status$, {
    initialValue: 'idle' as SyncStatus,
  });
  // True once a complete dictionary has been committed (atomic version stamp).
  // Drives the search-ready gate so we never read the store mid-import.
  protected hasCompleteDict = toSignal(this.#dictSync.hasCompleteDict$, {
    initialValue: false,
  });
  protected isSyncing = computed(
    () => this.syncStatus() === 'downloading' || this.syncStatus() === 'importing',
  );

  private searchbar = viewChild.required('searchbarInput', { read: ElementRef });
  private content = viewChild('content', { read: ElementRef });

  protected suggestions = signal<WordLang[]>([]);
  protected searchbarValue = signal('');
  protected showSearches = computed(() => this.suggestions().length > 0);
  // Detail tier for the results: `keywords` (the entry's own senses + derived
  // sub-headwords) or `all` (+ italic example usages and cross-references). The
  // header "more" button expands `keywords` → `all` one-way; it is not a toggle
  // and does not persist — every new lookup resets it back to `keywords` (see
  // `#results$`).
  protected detailLevel = signal<DetailLevel>('keywords');

  protected recentSearches = computed(() =>
    this.#historyService
      .history()
      .slice(0, MAX_RECENT_SEARCHES)
      .reverse()
      .map((e) => new WordLang(e.word, e.lang)),
  );

  protected hasMoreHistory = computed(
    () => this.#historyService.history().length > MAX_RECENT_SEARCHES,
  );

  // Fires on every ionViewWillLeave to tear down the per-visit keyup subscription
  // set up in ionViewWillEnter. Ionic caches this tab's page, so ngOnDestroy rarely
  // runs; without a per-visit teardown each re-entry would stack another live keyup
  // listener on the same input (duplicate lookups + a growing leak).
  #leave$ = new Subject<void>();

  // Clicking a breadcrumb is back-navigation within the trail; the looked-up
  // word should stay in place rather than jump to the end of history.
  #breadcrumbClicked = false;

  #results$ = this.#dictionaryService.lookupResult$.pipe(
    filter((results) => results !== null),
    tap((results) => {
      this.#recordHistory(results);
      // Each new lookup starts collapsed at the keywords tier; the "more" button
      // is not persistent across searches.
      this.detailLevel.set('keywords');
      if (results.groups.length > 0) {
        this.searchbarValue.set('');
      } else {
        // Redisplay the searched word rather than trusting whatever the
        // searchbar currently shows: most lookups (breadcrumb, suggestion,
        // base, or in-text word clicks) never touch the searchbar at all,
        // and even a typed lookup is async, so the user may have kept
        // typing before this "not found" result arrives.
        this.searchbarValue.set(results.target.word);
      }
      this.content()?.nativeElement.scrollToTop();
    }),
  );

  #recordHistory(results: LookupResult): void {
    const suppressHistoryAdd = this.#breadcrumbClicked;
    this.#breadcrumbClicked = false;
    if (results.groups.length > 0 && !suppressHistoryAdd) {
      this.#addRecentSearch(results.target);
    }
  }

  // Signal view of the lookup result, so `visibleBases` can be a computed rather
  // than a method re-run on every change-detection pass. `#results$` keeps its tap
  // side-effects (history, scroll, tier reset); toSignal subscribes to it once.
  protected results = toSignal(this.#results$);

  // The word highlighted (bold) in the breadcrumb trail.
  protected currentTarget = computed(() => this.results()?.target ?? null);

  // Whether the current lookup produced at least one entry, so the "more" button
  // is only offered when there is something to expand (and the F2 shortcut below
  // has something to act on).
  protected hasResults = computed(() => (this.results()?.groups.length ?? 0) > 0);

  #addRecentSearch(wordLang: WordLang): void {
    this.#historyService.add(wordLang.word, wordLang.lang);
  }

  #lookup(target: WordLang): void {
    this.#dictionaryService.lookup(target);
  }

  protected onBreadcrumbClicked(target: WordLang): void {
    this.#breadcrumbClicked = true;
    this.#lookup(target);
  }

  protected async openHistory(): Promise<void> {
    const modal = await this.#modalCtrl.create({
      component: HistoryModalComponent,
      breakpoints: [0, 0.5, 1],
      initialBreakpoint: 0.5,
      handleBehavior: 'cycle',
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<WordLang>();
    if (role === 'select' && data) {
      this.#lookup(data);
    }
  }

  ionViewWillEnter() {
    // Readiness comes from `hasCompleteDict` (driven by DictSyncService) — no
    // need to poll count() here, which would block on the IDB lock if a
    // worker import transaction were in flight.

    // Ref: https://github.com/ionic-team/ionic-framework/issues/7223
    const searchInputElement: HTMLInputElement =
      this.searchbar().nativeElement.querySelector('.searchbar-input');

    fromEvent<KeyboardEvent>(searchInputElement, 'keyup')
      .pipe(
        map((event) => ({
          isEnter: event.key === 'Enter',
          term: (event.target as HTMLInputElement).value.trim(),
        })),
        switchMap(({ isEnter, term }) => {
          const suggestions$ = term ? this.#getSuggestions(term) : of<WordLang[]>([]);

          if (isEnter) {
            // Fetch suggestions fresh for the typed term rather than reading
            // the `suggestions` signal: pressing Enter before the 250ms
            // debounce below has fired leaves the signal empty, dropping the
            // lookup into the target-language fallback below and missing
            // native-language words whose only resolution is a literal
            // suggestion (e.g. the Dutch "dozijn", which has no
            // target-language variation match).
            return suggestions$.pipe(map((suggestions) => ({ isEnter, suggestions })));
          }

          // Ordinary typing: debounce so we don't fetch suggestions on every
          // keystroke.
          return timer(250).pipe(
            switchMap(() => suggestions$),
            map((suggestions) => ({ isEnter, suggestions })),
          );
        }),
        takeUntil(this.#leave$),
      )
      .subscribe(({ isEnter, suggestions }) => {
        this.suggestions.set(suggestions);

        // Only act on Enter key presses; typing alone just updates the dropdown.
        if (!isEnter) return;

        if (suggestions.length > 0) {
          this.onSuggestionClicked(suggestions[0]);
        } else if (this.searchbarValue()) {
          // No literal suggestion matched: run a full variation-backed lookup on
          // the typed term so inflected forms (e.g. diambil -> ambil) resolve.
          this.#lookup(new WordLang(this.searchbarValue(), langConfig.targetLang));
        }

        // On mobile, blur the searchbar so the keyboard collapses after a lookup.
        if (this.#platform.is('mobile')) {
          searchInputElement.blur();
        }
      });
  }

  ionViewDidEnter() {
    // On desktop, focus the searchbar so the user can start typing immediately. On
    // mobile, don't focus it: the on-screen keyboard would pop up and obscure the
    // results. The user can tap the searchbar to focus it if they want to type.
    if (this.#platform.is('mobile')) return;

    const searchInputElement: HTMLInputElement =
      this.searchbar().nativeElement.querySelector('.searchbar-input');
    searchInputElement.focus();
  }

  // Tear down the keyup subscription created in ionViewWillEnter, so leaving and
  // re-entering the tab does not stack duplicate listeners on the same input.
  ionViewWillLeave() {
    this.#leave$.next();
  }

  ngOnDestroy() {
    this.onClear();
    this.#leave$.next();
    this.#leave$.complete();
  }

  // Never errors — callers get an empty result instead of having to guard
  // against a failed fetch themselves.
  #getSuggestions(name: string): Observable<WordLang[]> {
    return this.#dictionaryService
      .fetchSuggestions(name)
      .pipe(catchError(() => of<WordLang[]>([])));
  }

  protected onClear() {
    this.suggestions.set([]);
  }

  protected onSuggestionClicked(suggestion: WordLang) {
    this.onClear();
    this.#dictionaryService.lookup(suggestion);
  }

  protected onBaseClicked(base: WordLang) {
    this.#dictionaryService.lookup(base);
  }

  protected onWordClicked(event: MouseEvent) {
    this.#wordClickModalService.onClicked(event);
  }

  // Toggle the detail tier: `keywords` (senses + derived sub-headwords) ⇄ `all`
  // (+ usages and cross-references). A new search resets it to `keywords` in
  // `#results$`, so the toggle is non-persistent across lookups.
  protected toggleDetail() {
    this.detailLevel.update((l) => (l === 'keywords' ? 'all' : 'keywords'));
  }

  // Desktop shortcut for the header more/less button: F2 toggles the tier. Only
  // acts when there are results (matching the button's presence); works even
  // while the searchbar has focus, since F2 emits no character into it.
  @HostListener('document:keydown.f2', ['$event'])
  protected onToggleShortcut(event: Event) {
    if (!this.hasResults()) return;
    event.preventDefault();
    this.toggleDetail();
  }

  // Groups to render at the current tier. `all`: every group. Otherwise only
  // groups with at least one lemma visible at this tier — a group where the
  // searched word appears solely as a usage (e.g. "ekor" inside "ékor angin")
  // would otherwise render as an empty card below the `all` tier. A computed off
  // the result and tier signals, so it recomputes only when a lookup lands or
  // the tier is toggled, not on every change-detection pass.
  protected visibleGroups = computed<LookupGroup[]>(() => {
    const results = this.results();
    if (!results) return [];
    const level = this.detailLevel();
    if (level === 'all') return results.groups;
    return results.groups.filter((group) => group.lemmas.some((l) => lemmaVisibleAt(l, level)));
  });
}
