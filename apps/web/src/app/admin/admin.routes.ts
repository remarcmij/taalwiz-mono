import { Routes } from '@angular/router';

import { AdminPage } from './admin.page';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminPage,
  },
  {
    path: 'users',
    loadComponent: () => import('./users/users.page').then((p) => p.UsersPage),
  },
  {
    path: 'new-user',
    loadComponent: () =>
      import('./users/new-user/new-user.page').then((p) => p.NewUserPage),
  },
  {
    path: 'content',
    loadChildren: () =>
      import('./content/content.routes').then((r) => r.CONTENT_ROUTES),
  },
  {
    path: 'upload',
    loadComponent: () =>
      import('./content/upload/upload.page').then((p) => p.UploadPage),
  },
  {
    path: 'system-settings',
    loadComponent: () =>
      import('./system-settings/system-settings.page').then(
        (p) => p.SystemSettingsPage,
      ),
  },
];
