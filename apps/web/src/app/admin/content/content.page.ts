import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonReorder,
  IonReorderGroup,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ItemReorderEventDetail,
} from '@ionic/angular/standalone';

import { tap } from 'rxjs';

import { addIcons } from 'ionicons';
import { ellipsisHorizontalOutline } from 'ionicons/icons';

import { ContentService } from '../../home/content/content.service';
import { type ITopic } from '../../home/content/topic.model';
import { BackButtonComponent } from '../../shared/back-button/back-button.component';
import { AdminService } from '../admin.service';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonButton,
    IonIcon,
    IonContent,
    IonSpinner,
    IonList,
    IonReorderGroup,
    IonItem,
    IonLabel,
    IonReorder,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
  ],
  templateUrl: './content.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentPage {
  #router = inject(Router);
  #contentService = inject(ContentService);
  #adminService = inject(AdminService);

  topics = signal<ITopic[]>([]);
  isDirty = signal(false);
  isLoading = signal(false);
  isReorderMode = signal(false);

  #origTopics$ = this.#contentService.fetchPublications().pipe(
    tap((topics) => {
      this.topics.set(topics);
    })
  );

  #origTopics = toSignal(this.#origTopics$, { initialValue: [] as ITopic[] });

  ionViewDidLeave() {
    if (this.isDirty()) {
      this.saveOrder();
    }
  }

  navigateToArticles(topic: ITopic) {
    if (!this.isReorderMode()) {
      this.#router.navigate(['/', 'admin', 'content', topic.groupName]);
    }
  }

  async presentActionSheet() {
    const action =
      await this.#adminService.presentReorderActionSheet('Publications');
    if (action === 'reorder') {
      this.isReorderMode.set(true);
    }
  }

  handleReorder(ev: CustomEvent<ItemReorderEventDetail>) {
    this.isDirty.set(true);
    this.topics.update((topics) => ev.detail.complete(topics));
  }

  toggleReorder() {
    this.isReorderMode.update((value) => !value);
  }

  resetOrder() {
    this.isReorderMode.set(false);
    this.isDirty.set(false);
    this.topics.set([...this.#origTopics()]);
  }

  saveOrder() {
    const ids = this.topics().map((topic) => ({ id: topic._id }));
    this.isLoading.set(true);

    this.#adminService.updateSortIndices(ids).subscribe((success) => {
      this.isLoading.set(false);
      if (success) {
        this.isDirty.set(false);
        this.isReorderMode.set(false);
        this.#contentService.clearCache();
      }
    });
  }

  constructor() {
    addIcons({ ellipsisHorizontalOutline });
  }
}
