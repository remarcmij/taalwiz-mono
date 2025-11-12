import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonRow,
  IonTextarea,
  IonTitle,
  IonToolbar,
  LoadingController,
  NavController,
} from '@ionic/angular/standalone';

import { TranslateService } from '@ngx-translate/core';
import { first, switchMap, tap } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/user.model';
import { homeUrl } from '../../home/home.routes';
import { BackButtonComponent } from '../../shared/back-button/back-button.component';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    FormsModule,
    SharedModule,
    BackButtonComponent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonTextarea,
    IonButton,
  ],
  templateUrl: './contact.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPage {
  #http = inject(HttpClient);
  #loadingCtrl = inject(LoadingController);
  #alertCtrl = inject(AlertController);
  #navCtrl = inject(NavController);
  #authService = inject(AuthService);
  #translate = inject(TranslateService);

  async onSubmit(form: NgForm) {
    if (!form.valid) {
      return;
    }
    const { message } = form.value;

    const loadingEl = await this.#loadingCtrl.create({
      keyboardClose: true,
      message: this.#translate.instant('auth.logging-in'),
    });
    loadingEl.present();

    let user: User;

    this.#authService.user$
      .pipe(
        first(),
        tap((usr) => {
          if (!usr) {
            throw new Error('User not found');
          }
          user = usr;
        }),
        switchMap(() => this.#authService.getRequestHeaders()),
        switchMap((headers) => {
          return this.#http.post(
            '/api/contact',
            { message, email: user.email },
            { headers },
          );
        }),
      )
      .subscribe({
        next: (res) => {
          form.reset();
          loadingEl.dismiss();
          this.showAlert(this.#translate.instant('user.contact-sent')).then(
            () => {
              this.#navCtrl.navigateBack(homeUrl);
            },
          );
        },
        error: (err) => {
          loadingEl.dismiss();
          this.showAlert(this.#translate.instant('user.contact-failed'));
        },
      });
  }

  private showAlert(message: string) {
    return this.#alertCtrl
      .create({
        header: this.#translate.instant('user.contact'),
        message,
        buttons: [this.#translate.instant('common.close')],
      })
      .then((alertEl) => {
        alertEl.present();
        return alertEl.onDidDismiss();
      });
  }
}
