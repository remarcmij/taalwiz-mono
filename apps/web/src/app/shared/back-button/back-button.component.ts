import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonBackButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [IonBackButton],
  template: `
    <ion-back-button text="" defaultHref="/home/tabs/content"></ion-back-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackButtonComponent {}
