import { DecimalPipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonProgressBar,
  IonRow,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { alertOutline, checkmarkOutline, closeOutline } from 'ionicons/icons';

import { FileUploader, FileUploadModule } from 'ng2-file-upload';
import { first, take } from 'rxjs';

import { AuthService } from '../../../auth/auth.service';
import { ContentService } from '../../../home/content/content.service';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.page.html',
  styleUrls: ['./upload.page.scss'],
  standalone: true,
  imports: [
    FileUploadModule,
    NgClass,
    DecimalPipe,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonProgressBar,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon,
    IonButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UploadPage implements OnInit {
  #authService = inject(AuthService);
  #alertCtrl = inject(AlertController);
  #contentService = inject(ContentService);

  theUploader = signal<FileUploader | null>(null);
  hasBaseDropZoneOver = signal(false);
  hasAnotherDropZoneOver = false;
  showProgressBar = signal(false);
  progress = signal(0);

  constructor() {
    addIcons({ checkmarkOutline, alertOutline, closeOutline });
  }

  ngOnInit() {
    let errorMessages: string[] = [];

    this.#authService.token.pipe(first()).subscribe((token) => {
      const uploader = new FileUploader({
        url: '/api/admin/upload',
        authToken: 'Bearer ' + token,
        isHTML5: true,
      });

      uploader.onErrorItem = (item, response, status, headers) => {
        const body = JSON.parse(response);
        errorMessages.push(`${item.file.name}: ${body.message}`);
      };

      uploader.onProgressAll = (progress) => {
        this.progress.set(progress / 100);
      };

      uploader.onCompleteAll = () => {
        this.showProgressBar.set(false);
        this.#contentService.clearCache();
        let header = 'Upload complete';
        let message = 'All files have been uploaded';
        if (errorMessages.length > 0) {
          header = 'Upload complete with errors';
          message = errorMessages.join(', ');
        }
        this.#alertCtrl
          .create({ header, message, buttons: ['OK'] })
          .then((alertEl) => {
            alertEl.present();
            errorMessages = [];
          });
      };

      this.theUploader.set(uploader);
    });
  }

  fileOverBase(e: any) {
    this.hasBaseDropZoneOver.set(e);
  }

  fileOverAnother(e: any) {
    this.hasAnotherDropZoneOver = e;
  }

  uploadAll() {
    this.showProgressBar.set(true);
    this.theUploader()!.uploadAll();
  }

  cancelAll() {
    this.showProgressBar.set(false);
    this.theUploader()!.cancelAll();
  }
}
