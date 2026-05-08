import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonReorder,
  IonReorderGroup,
  IonTitle,
  IonToast,
  IonToolbar,
  ItemReorderEventDetail,
} from '@ionic/angular/standalone';

import { from, map, mergeAll, takeLast } from 'rxjs';

import { addIcons } from 'ionicons';
import { ellipsisHorizontalOutline, trash } from 'ionicons/icons';

import { ContentService } from '../../../home/content/content.service';
import { type ITopic } from '../../../home/content/topic.model';
import { BackButtonComponent } from '../../../shared/back-button/back-button.component';
import { AdminService } from '../../admin.service';

@Component({
  selector: 'app-publication',
  imports: [
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonReorderGroup,
    IonItemSliding,
    IonItem,
    IonLabel,
    IonReorder,
    IonItemOptions,
    IonItemOption,
    IonToast,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
  ],
  templateUrl: './publication.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicationPage {
  #router = inject(Router);
  #route = inject(ActivatedRoute);
  #alertCtrl = inject(AlertController);
  #actionSheetCtrl = inject(ActionSheetController);
  #contentService = inject(ContentService);
  #adminService = inject(AdminService);

  #indexTopic?: ITopic;
  #resetTopics: ITopic[] = [];

  topics = signal<ITopic[]>([]);
  publicationTitle = signal('Publication');
  isToastOpen = signal(false);
  isDirty = signal(false);
  isReorderMode = signal(false);

  ionViewWillEnter() {
    const groupName = this.#route.snapshot.params['groupName'];
    this.#contentService
      .fetchPublicationTopics(groupName)
      .subscribe((topics) => {
        this.topics.set(topics.filter((topic) => topic.type === 'article'));
        this.#resetTopics = [...this.topics()];
        this.#indexTopic = topics.find((topic) => topic.type === 'index');
        if (this.#indexTopic) {
          this.publicationTitle.set(this.#indexTopic.title);
        }
      });
  }

  ionViewDidLeave() {
    if (this.isDirty()) {
      this.saveOrder();
    }
  }

  navigateToArticle(topic: ITopic) {
    if (!this.isReorderMode()) {
      this.#router.navigate([
        '/',
        'admin',
        'content',
        'article',
        topic.filename,
      ]);
    }
  }

  async presentActionSheet() {
    const actionSheet = await this.#actionSheetCtrl.create({
      header: 'Articles',
      buttons: [
        {
          text: `Reorder articles`,
          data: {
            action: 'reorder',
          },
          handler: () => {
            this.isReorderMode.set(true);
          },
        },
        {
          text: 'Delete all articles',
          role: 'destructive',
          handler: () => {
            this.onDeleteAll();
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
          data: {
            action: 'cancel',
          },
        },
      ],
    });
    await actionSheet.present();
  }

  handleReorder(ev: CustomEvent<ItemReorderEventDetail>) {
    this.isDirty.set(true);
    this.topics.set(ev.detail.complete(this.topics()));
  }

  toggleReorder() {
    this.isReorderMode.update((value) => !value);
  }

  resetOrder() {
    this.isReorderMode.set(false);
    this.isDirty.set(false);
    this.topics.set([...this.#resetTopics]);
  }

  saveOrder() {
    let ids = this.topics().map((topic) => ({ id: topic._id }));

    // Ensure the index topic is always first
    if (this.#indexTopic) {
      ids = [{ id: this.#indexTopic._id }, ...ids];
    }

    this.#adminService.updateSortIndices(ids).subscribe((success) => {
      if (success) {
        this.isDirty.set(false);
        this.isReorderMode.set(false);
        this.#contentService.clearCache();
      }
    });
  }

  async onDeleteArticle(topic: ITopic, slidingItem: IonItemSliding) {
    slidingItem.close();

    const deleteObs$ = this.#adminService.deleteTopic(topic.filename);
    const confirmedObs$ = await this.#adminService.deleteConfirmed(deleteObs$);

    confirmedObs$.subscribe((result) => {
      if (result) {
        this.topics.update((topics) =>
          topics.filter((t) => t._id !== topic._id)
        );
        this.isToastOpen.set(true);
      }
    });
  }

  async onDeleteAll() {
    const topics = [...this.topics(), this.#indexTopic!];
    const deleteObs$ = from(topics).pipe(
      map((topic) => this.#adminService.deleteTopic(topic.filename)),
      mergeAll()
    );

    const confirmedObs$ = await this.#adminService.deleteConfirmed(deleteObs$);
    confirmedObs$.pipe(takeLast(1)).subscribe(async (result) => {
      if (!result) {
        return;
      }
      this.#contentService.clearCache();
      this.topics.set([]);
      const alertEl = await this.#alertCtrl.create({
        header: 'Delete Publication',
        message:
          'The publication and all its articles have been deleted successfully.',
        buttons: ['OK'],
      });
      alertEl.present();
      await alertEl.onDidDismiss();
      this.#router.navigateByUrl('/admin/content');
    });
  }

  constructor() {
    addIcons({ ellipsisHorizontalOutline, trash });
  }
}
