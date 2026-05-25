import { AsyncPipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
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
import { WordClickModalService } from '../../shared/word-click-modal/word-click-modal.service';
import { DictStoreService } from './dict-store.service';
import { DictSyncService, SyncStatus } from './dict-sync.service';
import { DictionaryService } from './dictionary.service';
import { HistoryModalComponent } from './history-modal/history-modal.component';
import { LemmaComponent } from './lemma/lemma.component';
import { SearchHistoryService } from './search-history.service';
import { SearchbarDropdownComponent } from './searchbar/searchbar-dropdown/searchbar-dropdown.component';
import { WordLang } from './word-lang.model';

const MAX_RECENT_SEARCHES = 4;

@Component({
  selector: 'app-dictionary',
  imports: [
    AsyncPipe,
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
  #dictStore = inject(DictStoreService);
  protected syncStatus = toSignal(inject(DictSyncService).status$, {
    initialValue: 'idle' as SyncStatus,
  });
  protected dictIsEmpty = signal(true);

  @ViewChild('searchbarInput', { read: ElementRef }) searchbar!: ElementRef;
  @ViewChild('content', { read: ElementRef }) content!: ElementRef<IonContent>;

  suggestions = signal<WordLang[]>([]);
  word = signal('');
  showSearches = signal(false);
  currentTarget = signal<WordLang | null>(null);

  recentSearches = computed(() =>
    this.#historyService
      .history()
      .slice(0, MAX_RECENT_SEARCHES)
      .reverse()
      .map((e) => new WordLang(e.word, e.lang)),
  );

  hasMoreHistory = computed(() => this.#historyService.history().length > MAX_RECENT_SEARCHES);

  #destroy$ = new Subject<void>();

  results$ = this.#dictionaryService.lookupResult$.pipe(
    filter(Boolean),
    tap((results) => {
      this.currentTarget.set(results.targetBase);
      if (results.bases.length > 0) {
        this.addRecentSearch(results.targetBase!);
        this.word.set('');
      } else {
        this.word.set(results.targetBase!.word);
      }
      this.content?.nativeElement.scrollToTop();
    }),
  );

  addRecentSearch(wordLang: WordLang): void {
    this.#historyService.add(wordLang.word, wordLang.lang);
  }

  lookup(target: WordLang): void {
    this.#dictionaryService.lookup(target);
  }

  async openHistory(): Promise<void> {
    const modal = await this.#modalCtrl.create({
      component: HistoryModalComponent,
      breakpoints: [0, 0.5, 1],
      initialBreakpoint: 0.5,
      handleBehavior: 'cycle',
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<WordLang>();
    if (role === 'select' && data) {
      this.lookup(data);
    }
  }

  ionViewWillEnter() {
    this.#dictStore.count().then((n) => this.dictIsEmpty.set(n === 0));

    // Ref: https://github.com/ionic-team/ionic-framework/issues/7223
    const searchInputElement: HTMLInputElement =
      this.searchbar.nativeElement.querySelector('.searchbar-input');

    let keyupKey = '';
    fromEvent<KeyboardEvent>(searchInputElement, 'keyup')
      .pipe(
        tap((event) => (keyupKey = event.key)),
        map((event) => (event.target as HTMLInputElement).value),
        switchMap((term) =>
          keyupKey === 'Enter'
            ? of(this.suggestions())
            : timer(250).pipe(
                switchMap(() => (term ? this.getSuggestions(term) : of<WordLang[]>([]))),
              ),
        ),
        tap((suggestions) => {
          this.showSearches.set(suggestions.length > 0);
        }),
        catchError(() => of<WordLang[]>([])),
        takeUntil(this.#destroy$),
      )
      .subscribe((suggestions) => {
        this.suggestions.set(suggestions);
        if (keyupKey === 'Enter') {
          if (suggestions.length > 0) {
            this.onItemClicked(suggestions[0]);
          }
          if (this.#platform.is('mobile')) {
            searchInputElement.blur();
          }
        }
      });
  }

  ionViewDidEnter() {
    const searchInputElement: HTMLInputElement =
      this.searchbar.nativeElement.querySelector('.searchbar-input');
    searchInputElement.focus();
  }

  ngOnDestroy() {
    this.onClear();
    this.#destroy$.next();
    this.#destroy$.complete();
  }

  getSuggestions(name: string): Observable<WordLang[]> {
    return this.#dictionaryService.fetchSuggestions(name);
  }

  onClear() {
    this.suggestions.set([]);
    this.showSearches.set(false);
  }

  onItemClicked(suggestion: WordLang) {
    this.onClear();
    this.#dictionaryService.lookup(suggestion);
  }

  onBaseClicked(suggestion: WordLang) {
    this.#dictionaryService.lookup(suggestion);
  }

  onWordClicked(event: MouseEvent) {
    this.#wordClickModalService.onClicked(event);
  }
}
