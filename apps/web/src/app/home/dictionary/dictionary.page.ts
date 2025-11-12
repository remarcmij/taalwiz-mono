import { AsyncPipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
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
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import {
  Observable,
  Subject,
  catchError,
  debounceTime,
  fromEvent,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

import { TranslatePipe } from '@ngx-translate/core';
import { WordClickModalService } from '../../shared/word-click-modal/word-click-modal.service';
import { DictionaryService } from './dictionary.service';
import { LemmaComponent } from './lemma/lemma.component';
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

  @ViewChild('searchbarInput', { read: ElementRef }) searchbar!: ElementRef;
  @ViewChild('content', { read: ElementRef }) content!: ElementRef<IonContent>;

  suggestions = signal<WordLang[]>([]);
  word = signal('');
  showSearches = signal(false);
  recentSearches = signal<WordLang[]>([]);
  // results = signal(new LookupResult());

  #destroy$ = new Subject<void>();

  results$ = this.#dictionaryService.lookupResult$.pipe(
    tap((results) => {
      this.word.set(results.targetBase!.word);
      this.addRecentSearch(results.targetBase!);
      this.content?.nativeElement.scrollToTop();
    })
  );

  addRecentSearch(wordLang: WordLang) {
    this.recentSearches.update((values) => {
      const newValues = values.filter((v) => v.key !== wordLang.key);
      newValues.push(wordLang);
      if (newValues.length > MAX_RECENT_SEARCHES) {
        newValues.shift();
      }
      return newValues;
    });
  }

  lookup(target: WordLang) {
    this.#dictionaryService.lookup(target);
  }

  ionViewWillEnter() {
    // Ref: https://github.com/ionic-team/ionic-framework/issues/7223
    const searchInputElement: HTMLInputElement =
      this.searchbar.nativeElement.querySelector('.searchbar-input');

    let keyupKey = '';
    fromEvent<KeyboardEvent>(searchInputElement, 'keyup')
      .pipe(
        tap((event) => (keyupKey = event.key)),
        map((event) => (event.target as HTMLInputElement).value),
        debounceTime(250),
        switchMap((term) =>
          term ? this.getSuggestions(term) : of<WordLang[]>([])
        ),
        tap((suggestions) => {
          this.showSearches.set(suggestions.length > 0);
        }),
        catchError(() => of<WordLang[]>([])),
        takeUntil(this.#destroy$)
      )
      .subscribe((suggestions) => {
        this.suggestions.set(suggestions);
        if (keyupKey === 'Enter' && suggestions.length > 0) {
          this.onItemClicked(suggestions[0]);
          searchInputElement.blur();
        }
      });
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
