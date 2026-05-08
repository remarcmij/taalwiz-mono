import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { MarkdownService } from '../../content/markdown.service';
import { type ILemma } from './lemma.model';

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
  clicked = output<MouseEvent>();

  convertMarkdown(text: string) {
    return this.#markdownService.convertMarkdown(text);
  }
}
