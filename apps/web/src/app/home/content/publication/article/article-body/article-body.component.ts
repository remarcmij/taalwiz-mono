import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { type IArticle } from '../article.model';

@Component({
  selector: 'app-article-body',
  standalone: true,
  templateUrl: './article-body.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleBodyComponent implements OnInit {
  #sanitizer = inject(DomSanitizer);

  article = input.required<IArticle>();
  clicked = output<MouseEvent>();

  safeHtml = signal<SafeHtml | null>(null);

  ngOnInit() {
    this.safeHtml.set(
      this.#sanitizer.bypassSecurityTrustHtml(this.article().htmlText),
    );
  }
}
