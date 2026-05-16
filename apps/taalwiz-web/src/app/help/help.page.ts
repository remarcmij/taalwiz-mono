import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { filter, map, of, switchMap } from 'rxjs';

import { TranslatePipe } from '@ngx-translate/core';
import { ContentService } from '../home/content/content.service';
import { BackButtonComponent } from '../shared/back-button/back-button.component';

@Component({
  selector: 'app-help',
  imports: [
    AsyncPipe,
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    TranslatePipe,
  ],
  templateUrl: './help.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpPage {
  #sanitizer = inject(DomSanitizer);
  #contentService = inject(ContentService);

  safeHtml$ = of('help.md').pipe(
    switchMap((slug) =>
      this.#contentService.fetchArticle(slug).pipe(
        filter((article) => !!article),
        map((article) =>
          this.#sanitizer.bypassSecurityTrustHtml(article.htmlText)
        )
      )
    )
  );
}
