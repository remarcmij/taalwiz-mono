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

import { type Article } from '../article.model';

@Component({
  selector: 'app-article-body',
  templateUrl: './article-body.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleBodyComponent implements OnInit {
  #sanitizer = inject(DomSanitizer);

  article = input.required<Article>();
  clicked = output<MouseEvent>();
  keyPressed = output<KeyboardEvent>();

  safeHtml = signal<SafeHtml | null>(null);

  ngOnInit() {
    this.safeHtml.set(this.#sanitizer.bypassSecurityTrustHtml(this.article().htmlText));
  }
}
