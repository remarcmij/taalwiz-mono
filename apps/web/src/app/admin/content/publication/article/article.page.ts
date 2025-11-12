import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { schoolOutline } from 'ionicons/icons';

import { type IArticle } from '../../../../home/content/publication/article/article.model';
import { BackButtonComponent } from '../../../../shared/back-button/back-button.component';
import { AdminService } from '../../../admin.service';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [
    NgClass,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonButton,
    IonContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonButton,
    IonContent,
  ],
  templateUrl: './article.page.html',
  styleUrls: ['./article.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticlePage implements OnInit {
  #router = inject(Router);
  #activatedRoute = inject(ActivatedRoute);
  #sanitizer = inject(DomSanitizer);
  #alertCtrl = inject(AlertController);
  #adminService = inject(AdminService);

  #article!: IArticle;
  title = signal<string>('');
  safeHtml = signal<SafeHtml | null>(null);
  isDeleted = signal(false);

  ngOnInit() {
    this.#activatedRoute.data.subscribe(({ article }) => {
      this.#article = article;
      this.title.set(article.title);
      this.safeHtml.set(
        this.#sanitizer.bypassSecurityTrustHtml(article.htmlText)
      );
    });
  }

  async onDelete() {
    const deleteObs$ = this.#adminService.deleteTopic(this.#article.filename);
    const confirmedObs$ = await this.#adminService.deleteConfirmed(deleteObs$);

    confirmedObs$.subscribe(async (result) => {
      if (!result) {
        return;
      }
      this.isDeleted.set(true);
      const alertEl = await this.#alertCtrl.create({
        header: 'Delete Article',
        message: 'The article has been deleted successfully.',
        buttons: ['OK'],
      });
      alertEl.present();
      await alertEl.onDidDismiss();
      this.#router.navigate(['/admin/content', this.#article.groupName]);
    });
  }

  constructor() {
    addIcons({ schoolOutline });
  }
}
