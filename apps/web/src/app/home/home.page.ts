import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { libraryOutline, navigateOutline, searchOutline } from 'ionicons/icons';

import { TranslatePipe } from '@ngx-translate/core';
// import { SharedModule } from '../shared/shared.module';

@Component({
  selector: 'app-home',
  // standalone: true,
  imports: [
    // SharedModule,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    TranslatePipe,
  ],
  templateUrl: './home.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  constructor() {
    addIcons({ libraryOutline, searchOutline, navigateOutline });
  }
}
