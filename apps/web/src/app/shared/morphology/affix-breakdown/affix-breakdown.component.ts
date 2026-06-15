import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronUpOutline } from 'ionicons/icons';
import { type SegmentResult } from '../../../home/dictionary/indonesian-segmenter';

/**
 * Renders an affix decomposition line (e.g. "meN- + sapu + -kan") with an
 * optional, expandable nasal-allomorphy rule note. Shared by the word-tap modal
 * and the SRS study card back. The breakdown is an automated annotation, not
 * authoritative Teeuw content, so it is dimmed as a provenance signal.
 */
@Component({
  selector: 'app-affix-breakdown',
  imports: [IonIcon, TranslatePipe],
  templateUrl: './affix-breakdown.component.html',
  styleUrl: './affix-breakdown.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffixBreakdownComponent {
  breakdown = input.required<SegmentResult>();
  protected expanded = signal(false);

  constructor() {
    addIcons({ chevronDownOutline, chevronUpOutline });
  }

  protected toggleExpanded(): void {
    this.expanded.update((v) => !v);
  }
}
