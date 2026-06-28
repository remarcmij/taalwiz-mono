import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MarkdownService } from '../../content/markdown.service';
import { lemmaVisibleAt, type DetailLevel, type ILemma } from './lemma.model';

@Component({
  selector: 'app-lemma',
  imports: [],
  templateUrl: './lemma.component.html',
  styleUrls: ['./lemma.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LemmaComponent {
  #markdownService = inject(MarkdownService);

  lemmas = input.required<ILemma[]>();
  /** Detail tier to render. `headword` (default) shows only the entry's own
   * senses — matching the condensed word-click dialog; `derived` adds derived
   * sub-headwords; `all` adds italic example usages. */
  level = input<DetailLevel>('headword');
  clicked = output<MouseEvent>();

  /** Lemmas visible at the current detail level. */
  displayLemmas = computed(() => this.lemmas().filter((l) => lemmaVisibleAt(l, this.level())));

  convertMarkdown(text: string) {
    return this.#markdownService.convertMarkdown(text);
  }
}
