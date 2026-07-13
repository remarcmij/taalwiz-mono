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
  /** Detail tier to render. `keywords` (default) shows the entry's own senses
   * and its derived sub-headwords; `all` additionally shows the italic example
   * usages and cross-references. */
  level = input<DetailLevel>('keywords');
  clicked = output<MouseEvent>();

  /** Lemmas visible at the current detail level, each flagged when it opens a
   * new homonym group (a different `homonym` number, or a different base) from
   * the previous visible lemma, so the template can space the groups apart. The
   * markdown HTML is rendered here, once per recomputation, rather than in a
   * template method that would re-run for every rendered lemma on each
   * change-detection pass. */
  displayLemmas = computed(() => {
    const visible = this.lemmas().filter((l) => lemmaVisibleAt(l, this.level()));
    return visible.map((lemma, idx) => {
      const prev = visible[idx - 1];
      const newHomonym =
        idx > 0 && (prev.baseWord !== lemma.baseWord || prev.homonym !== lemma.homonym);
      return { lemma, newHomonym, html: this.#markdownService.convertMarkdown(lemma.text) };
    });
  });
}
