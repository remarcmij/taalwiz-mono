import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { filter, map, switchMap } from 'rxjs';

import { ContentService } from '../home/content/content.service';
import { BackButtonComponent } from '../shared/back-button/back-button.component';
import { SharedModule } from '../shared/shared.module';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [
    AsyncPipe,
    SharedModule,
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
  ],
  templateUrl: './about.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutPage {
  #route = inject(ActivatedRoute);
  #sanitizer = inject(DomSanitizer);
  #contentService = inject(ContentService);

  safeHtml$ = this.#route.paramMap.pipe(
    map((params) => params.get('lang') ?? 'en'),
    switchMap((lang) =>
      this.#contentService.fetchArticle(`about.${lang}.md`).pipe(
        filter((article) => !!article),
        map((article) =>
          this.#sanitizer.bypassSecurityTrustHtml(article.htmlText),
        ),
      ),
    ),
  );
}
