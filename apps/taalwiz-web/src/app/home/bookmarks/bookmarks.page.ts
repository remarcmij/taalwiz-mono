import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonContent,
  IonHeader,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonMenuButton,
  IonNote,
  IonButtons,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { DictionaryService } from '../dictionary/dictionary.service';
import { WordLang } from '../dictionary/word-lang.model';
import { BookmarkEntry, BookmarkService } from './bookmark.service';

@Component({
  selector: 'app-bookmarks',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonList,
    IonItemSliding,
    IonItem,
    IonLabel,
    IonNote,
    IonBadge,
    IonItemOptions,
    IonItemOption,
    TranslatePipe,
  ],
  templateUrl: './bookmarks.page.html',
  styleUrls: ['./bookmarks.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookmarksPage {
  protected bookmarkService = inject(BookmarkService);
  #dictionaryService = inject(DictionaryService);
  #router = inject(Router);

  lookup(entry: BookmarkEntry): void {
    this.#router.navigate(['home/tabs/dictionary']);
    this.#dictionaryService.lookup(new WordLang(entry.word, entry.lang));
  }

  relativeTime(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return '< 1m';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  }
}
