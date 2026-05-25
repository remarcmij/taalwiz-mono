import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ActionSheetController,
  AlertController,
} from '@ionic/angular/standalone';
import { catchError, filter, Observable, of, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
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
  #authService = inject(AuthService);
  #apiErrorAlertService = inject(ApiErrorAlertService);

  getGroups() {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) return of([]);
        return this.#http.get<string[]>('/api/v1/content/groups', { headers });
      }),
      catchError((error) => {
        this.#apiErrorAlertService.showError(error);
        return of([]);
      })
    );
  }

  updateUserGroups(id: string, groups: string[]) {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) return of(null);
        return this.#http.patch<User>(`/api/v1/users/${id}/groups`, { groups }, { headers });
      })
    );
  }

  getUsers() {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of([]);
        }
        return this.#http.get<User[]>('/api/v1/users', { headers });
      }),
      catchError((error) => {
        this.#apiErrorAlertService.showError(error);
        return of([]);
      })
    );
  }

  deleteUser(id: string) {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of(null);
        }
        return this.#http.delete(`/api/v1/users/${id}`, { headers });
      })
    );
  }

  inviteNewUser(email: string, lang: string) {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of(null);
        }
        return this.#http.post(
          `/api/v1/users/invite`,
          { email, lang },
          { headers }
        );
      })
    );
  }

  reprocessHashtags() {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) return of(null);
        return this.#http.post('/api/v1/content/reprocess-hashtags', {}, { headers });
      })
    );
  }

  deleteTopic(filename: string) {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of(null);
        }
        return this.#http.delete(`/api/v1/content/${filename}`, { headers });
      })
    );
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
      })
    );
  }

  getSettings(): Observable<ISystemSettings[]> {
    return this.#authService.getRequestHeaders().pipe(
      filter((headers) => !!headers),
      switchMap((headers) =>
        this.#http.get<ISystemSettings[]>('/api/v1/admin/settings', {
          headers,
        })
      ),
      catchError((error) => {
        this.#apiErrorAlertService.showError(error);
        return of([]);
      })
    );
  }

  updateSettings(settings: ISystemSettings[]) {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of(null);
        }
        return this.#http.patch(
          '/api/v1/admin/settings',
          { settings },
          { headers }
        );
      })
    );
  }
}
