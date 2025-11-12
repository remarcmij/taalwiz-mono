import { AsyncPipe, CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';

import { Observable } from 'rxjs';

import { SharedModule } from '../../../../shared/shared.module';
import { type IArticle } from '../../publication/article/article.model';
import { type IHashtag } from '../hashtag.model';
import { HashtagsService } from '../hashtags.service';

@Component({
  selector: 'app-hashtag-modal',
  standalone: true,
  imports: [
    SharedModule,
    AsyncPipe,
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
  ],
  templateUrl: './hashtag-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HashtagModalComponent implements OnInit {
  #router = inject(Router);
  #modalCtrl = inject(ModalController);
  #hashTagService = inject(HashtagsService);

  hashtagName = input.required<string>();
  article = input<IArticle | null>(null);

  hashtags$!: Observable<IHashtag[]>;

  ngOnInit() {
    this.hashtags$ = this.#hashTagService.searchHashtags(this.hashtagName());
  }

  onClick(hashtag: IHashtag) {
    this.#modalCtrl.dismiss(null, 'close');
    this.#router.navigate(['/home/tabs/content/article', hashtag.filename], {
      queryParams: { id: hashtag.id },
      // replaceUrl: true,
    });
  }
}
