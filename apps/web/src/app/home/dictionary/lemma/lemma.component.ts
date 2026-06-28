import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MarkdownService } from '../../content/markdown.service';
import { isHeadwordLemma, type ILemma } from './lemma.model';

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
  /** When false (default) only headword definitions are shown; the keyword=0
   * lines (italic example usages and derived-form cross-references of the
   * searched word) are hidden, mirroring the condensed word-click dialog. */
  showUsages = input<boolean>(false);
  clicked = output<MouseEvent>();

  /** Lemmas to render: all when expanded, else just those where the searched
   * word is the headword (`keyword === 1`, defaulting to a headword). */
  displayLemmas = computed(() =>
    this.showUsages() ? this.lemmas() : this.lemmas().filter(isHeadwordLemma),
  );

  convertMarkdown(text: string) {
    return this.#markdownService.convertMarkdown(text);
  }
}
