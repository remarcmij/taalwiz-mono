import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ActionSheetController,
  AlertController,
} from '@ionic/angular/standalone';
import { catchError, filter, map, Observable, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { User } from '../auth/user.model';
import { ContentService } from '../home/content/content.service';
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
  #contentService = inject(ContentService);
  #apiErrorAlertService = inject(ApiErrorAlertService);

  getUsers() {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of([]);
        }
        return this.#http.get<User[]>('/api/v1/users', { headers });
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

  updateSortIndices(ids: { id: string }[]) {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of(false);
        }
        return this.#http
          .patch(
            '/api/v1/content/sort',
            ids.map((id) => id.id),
            { headers }
          )
          .pipe(map(() => true));
      }),
      tap(() => {
        this.#contentService.clearCache();
      }),
      catchError((error) => {
        this.#alertCtrl
          .create({
            header: 'Server Error',
            message: error.error.message || 'An error occurred!',
            buttons: ['OK'],
          })
          .then((alertEl) => {
            alertEl.present();
          });
        return of(false);
      })
    );
  }

  deleteTopic(filename: string) {
    return this.#authService.getRequestHeaders().pipe(
      switchMap((headers) => {
        if (!headers) {
          return of(null);
        }
        return this.#http.delete(`/api/admin/topics/${filename}`, { headers });
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

    // TODO use handler, check admin content page

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

  async presentReorderActionSheet(itemType: string) {
    const actionSheet = await this.#actionSheetCtrl.create({
      header: 'Options',
      buttons: [
        {
          text: `Reorder ${itemType}`,
          data: {
            action: 'reorder',
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
    await actionSheet.present();
    const response = await actionSheet.onDidDismiss();
    return response.data.action;
  }

  getSettings(): Observable<ISystemSettings[]> {
    return this.#authService.getRequestHeaders().pipe(
      filter((headers) => !!headers),
      switchMap((headers) =>
        this.#http.get<ISystemSettings[]>('/api/admin/settings', {
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
          '/api/admin/settings',
          { settings },
          { headers }
        );
      })
    );
  }
}
