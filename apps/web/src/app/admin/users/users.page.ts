import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  IonBackButton,
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

import { addIcons } from 'ionicons';
import { trash } from 'ionicons/icons';

import { User } from '../../auth/user.model';
import { AdminService } from '../admin.service';

@Component({
  selector: 'app-users',
  imports: [
    DatePipe,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonList,
    IonItemSliding,
    IonItem,
    IonLabel,
    IonItemOptions,
    IonItemOption,
    IonIcon,
    IonToast,
  ],
  templateUrl: './users.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  #adminService = inject(AdminService);

  users = signal<User[]>([]);
  isToastOpen = signal(false);

  ionViewWillEnter() {
    this.#adminService.getUsers().subscribe((users) => {
      this.users.set(
        users
          .filter((user) => user.role !== 'admin')
          .sort((a, b) => a.email.localeCompare(b.email))
      );
    });
  }

  async onDeleteUser(id: string, slidingItem: IonItemSliding) {
    slidingItem.close();

    const deleteObs$ = this.#adminService.deleteUser(id);
    const confirmedObs$ = await this.#adminService.deleteConfirmed(deleteObs$);

    confirmedObs$.subscribe((result) => {
      if (result) {
        this.users.update((users) => users.filter((user) => user._id !== id));
        this.isToastOpen.set(true);
      }
    });
  }

  constructor() {
    addIcons({ trash });
  }
}
