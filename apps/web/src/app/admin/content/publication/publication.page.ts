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
  IonTitle,
  IonToast,
  IonToolbar,
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
    IonItemSliding,
    IonItem,
    IonLabel,
    IonItemOptions,
    IonItemOption,
    IonToast,
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

  topics = signal<ITopic[]>([]);
  publicationTitle = signal('Publication');
  isToastOpen = signal(false);

  ionViewWillEnter() {
    const groupName = this.#route.snapshot.params['groupName'];
    this.#contentService
      .fetchPublicationTopics(groupName)
      .subscribe((topics) => {
        this.topics.set(topics.filter((t) => t.type === 'article' || t.type === 'manifest'));
        const manifestTopic = topics.find((t) => t.type === 'manifest');
        if (manifestTopic) {
          this.publicationTitle.set(manifestTopic.title);
        }
      });
  }

  navigateToArticle(topic: ITopic) {
    this.#router.navigate([
      '/',
      'admin',
      'content',
      'article',
      topic.filename.replace('.md', ''),
    ]);
  }

  async presentActionSheet() {
    const actionSheet = await this.#actionSheetCtrl.create({
      header: 'Articles',
      buttons: [
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
        },
      ],
    });
    await actionSheet.present();
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
    const deleteObs$ = from(this.topics()).pipe(
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
