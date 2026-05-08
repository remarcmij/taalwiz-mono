import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonList,
  IonRow,
  IonText,
  IonTitle,
  IonToolbar,
  LoadingController,
} from '@ionic/angular/standalone';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import {
  EMAIL_EXISTS,
  EMAIL_MISMATCH,
  MIN_PASSWORD_LENGTH,
  TOKEN_INVALID,
} from '../../server/shared/shared';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-auth',
  imports: [
    FormsModule,
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonText,
    IonList,
    IonItem,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
  ],
  templateUrl: './register.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage implements OnInit {
  #router = inject(Router);
  #route = inject(ActivatedRoute);
  #translate = inject(TranslateService);
  #loadingCtrl = inject(LoadingController);
  #alertCtrl = inject(AlertController);
  #authService = inject(AuthService);

  @ViewChild('nameInput') nameInput!: IonInput;
  #token = '';
  #lang = '';

  minLength = MIN_PASSWORD_LENGTH;
  email = signal('');
  name = signal('');
  password = signal('');

  ngOnInit() {
    this.#route.queryParamMap.subscribe((params) => {
      console.log('params', params);
      this.#token = params.get('token') || '';
      this.#lang = params.get('lang') || '';
      this.email.set(params.get('email') || '');
    });
    this.#translate.use(this.#lang);
  }

  ionViewDidEnter() {
    if (this.#token && this.email()) {
      this.nameInput.setFocus();
    }
  }

  async register(password: string) {
    const loadingEl = await this.#loadingCtrl.create({
      keyboardClose: true,
      message: this.#translate.instant('auth.activating-account'),
    });

    loadingEl.present();
    this.#authService
      .register(this.email(), password, this.name(), this.#token)
      .pipe(
        finalize(() => {
          loadingEl.dismiss();
        })
      )
      .subscribe({
        next: () => {
          this.#router.navigateByUrl(`/welcome/${this.#lang}`, {
            replaceUrl: true,
          });
        },
        error: (errResp) => {
          switch (errResp.error.message) {
            case EMAIL_EXISTS:
              this.showAlert(this.#translate.instant('auth.email-exists'));
              break;
            case EMAIL_MISMATCH:
              this.showAlert(
                this.#translate.instant('auth.code-email-mismatch')
              );
              break;
            case TOKEN_INVALID:
              this.showAlert(this.#translate.instant('auth.code-invalid'));
              break;
            default:
              this.showAlert(
                this.#translate.instant('auth.registration-failed')
              );
          }
        },
      });
  }

  onSubmit(form: NgForm) {
    if (!form.valid) {
      return;
    }

    const { password } = form.value;
    this.register(password);
  }

  private showAlert(message: string) {
    this.#alertCtrl
      .create({
        header: this.#translate.instant('auth.registration-error'),
        message,
        buttons: [this.#translate.instant('common.close')],
      })
      .then((alertEl) => {
        alertEl.present();
      });
  }
}
