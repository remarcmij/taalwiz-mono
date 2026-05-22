import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
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
  ModalController,
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { peopleOutline, trash } from 'ionicons/icons';

import { User } from '../../auth/user.model';
import { AdminService } from '../admin.service';
import { GroupsModalComponent } from './groups-modal/groups-modal.component';

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
    IonButton,
    IonLabel,
    IonChip,
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
  #modalCtrl = inject(ModalController);

  users = signal<User[]>([]);
  availableGroups = signal<string[]>([]);
  isToastOpen = signal(false);

  ionViewWillEnter() {
    this.#adminService.getUsers().subscribe((users) => {
      this.users.set(
        users
          .filter((user) => !user.roles.includes('admin'))
          .sort((a, b) => a.email.localeCompare(b.email))
      );
    });
    this.#adminService.getGroups().subscribe((groups) => {
      this.availableGroups.set(groups);
    });
  }

  async onManageGroups(user: User, slidingItem: IonItemSliding) {
    slidingItem.close();

    const modal = await this.#modalCtrl.create({
      component: GroupsModalComponent,
      componentProps: {
        email: user.email,
        availableGroups: this.availableGroups(),
        initialGroups: user.groups,
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss<string[]>();
    if (role === 'save' && data) {
      this.#adminService.updateUserGroups(user.id, data).subscribe((updated) => {
        if (updated) {
          this.users.update((users) =>
            users.map((u) => (u.id === user.id ? { ...u, groups: data } : u))
          );
        }
      });
    }
  }

  async onDeleteUser(id: string, slidingItem: IonItemSliding) {
    slidingItem.close();

    const deleteObs$ = this.#adminService.deleteUser(id);
    const confirmedObs$ = await this.#adminService.deleteConfirmed(deleteObs$);

    confirmedObs$.subscribe((result) => {
      if (result) {
        this.users.update((users) => users.filter((user) => user.id !== id));
        this.isToastOpen.set(true);
      }
    });
  }

  constructor() {
    addIcons({ trash, peopleOutline });
  }
}
