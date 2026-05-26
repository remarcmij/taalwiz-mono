import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ActionSheetController, AlertController } from '@ionic/angular/standalone';
import { catchError, Observable, of } from 'rxjs';
import { User } from '../auth/user.model';
import { ApiErrorAlertService } from '../shared/api-error-alert.service';
import { ISystemSettings } from './system-settings/system-settings.model';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  #http = inject(HttpClient);
  #actionSheetCtrl = inject(ActionSheetController);
  #alertCtrl = inject(AlertController);
  #apiErrorAlertService = inject(ApiErrorAlertService);

  getGroups() {
    return this.#http.get<string[]>('/api/v1/content/groups').pipe(
      catchError((error) => {
        this.#apiErrorAlertService.showError(error);
        return of([]);
      }),
    );
  }

  updateUserGroups(id: string, groups: string[]) {
    return this.#http.patch<User>(`/api/v1/users/${id}/groups`, { groups });
  }

  setUserSuspended(id: string, isSuspended: boolean): Observable<void> {
    return this.#http.patch<void>(`/api/v1/users/${id}/suspended`, { isSuspended });
  }

  adminSetPassword(id: string, newPassword: string): Observable<void> {
    return this.#http.patch<void>(`/api/v1/users/${id}/password`, { newPassword });
  }

  getUsers() {
    return this.#http.get<User[]>('/api/v1/users').pipe(
      catchError((error) => {
        this.#apiErrorAlertService.showError(error);
        return of([]);
      }),
    );
  }

  deleteUser(id: string) {
    return this.#http.delete(`/api/v1/users/${id}`);
  }

  inviteNewUser(email: string, lang: string) {
    return this.#http.post(`/api/v1/users/invite`, { email, lang });
  }

  reprocessHashtags() {
    return this.#http.post('/api/v1/content/reprocess-hashtags', {});
  }

  deleteTopic(filename: string) {
    return this.#http.delete(`/api/v1/content/${filename}`);
  }

  async deleteConfirmed<T>(deleteObs: Observable<T>) {
    const actionSheetEl = await this.#actionSheetCtrl.create({
      header: 'Are you sure?',
      buttons: [
        {
          text: 'Delete',
          role: 'destructive',
          data: {
            action: 'delete',
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
          data: {
            action: 'cancel',
          },
        },
      ],
    });

    await actionSheetEl.present();
    const resp = await actionSheetEl.onDidDismiss();

    if (resp.data.action === 'cancel') {
      return of(null);
    }

    return deleteObs.pipe(
      catchError((error) => {
        this.#alertCtrl
          .create({
            header: 'Server Error',
            message: error.error.message,
            buttons: ['Close'],
          })
          .then((alertEl) => alertEl.present());
        return of(null);
      }),
    );
  }

  getSettings(): Observable<ISystemSettings[]> {
    return this.#http.get<ISystemSettings[]>('/api/v1/admin/settings').pipe(
      catchError((error) => {
        this.#apiErrorAlertService.showError(error);
        return of([]);
      }),
    );
  }

  updateSettings(settings: ISystemSettings[]) {
    return this.#http.patch('/api/v1/admin/settings', { settings });
  }
}
