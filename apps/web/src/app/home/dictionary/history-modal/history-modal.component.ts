import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { SearchHistoryService, type HistoryEntry } from '../search-history.service';
import { WordLang } from '../word-lang.model';

@Component({
  selector: 'app-history-modal',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonBadge,
    TranslatePipe,
  ],
  templateUrl: './history-modal.component.html',
  styles: `
    ion-note[slot='end'] {
      margin-inline-end: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryModalComponent {
  #historyService = inject(SearchHistoryService);
  #modalCtrl = inject(ModalController);

  history = this.#historyService.history;

  select(entry: HistoryEntry): void {
    void this.#modalCtrl.dismiss(new WordLang(entry.word, entry.lang), 'select');
  }

  async clearHistory(): Promise<void> {
    await this.#historyService.clear();
  }

  relativeTime(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return '< 1m';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  }
}
