import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { homeOutline } from 'ionicons/icons';

import { filter, first, map, switchMap } from 'rxjs';

import { ContentService } from '../../home/content/content.service';
import { homeUrl } from '../../home/home.routes';
import { SharedModule } from '../../shared/shared.module';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [
    AsyncPipe,
    RouterLink,
    SharedModule,
    IonRouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonTitle,
    IonContent,
  ],
  templateUrl: './welcome.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomePage {
  #router = inject(Router);
  #route = inject(ActivatedRoute);
  #sanitizer = inject(DomSanitizer);
  #contentService = inject(ContentService);

  safeHtml$ = this.#route.paramMap.pipe(
    first(),
    switchMap((params) => {
      const lang = params.get('lang') || 'en';
      return this.#contentService.fetchArticle(`welcome.${lang}.md`);
    }),
    filter((article) => !!article),
    map((article) => this.#sanitizer.bypassSecurityTrustHtml(article.htmlText)),
  );

  goHome() {
    this.#router.navigateByUrl(homeUrl, { replaceUrl: true });
  }

  constructor() {
    addIcons({ homeOutline });
  }
}
