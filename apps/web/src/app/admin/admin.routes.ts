import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'users',
    pathMatch: 'full',
  },
  {
    path: 'users',
    loadComponent: () => import('./users/users.page').then((p) => p.UsersPage),
  },
  {
    path: 'new-user',
    loadComponent: () => import('./users/new-user/new-user.page').then((p) => p.NewUserPage),
  },
  {
    path: 'content',
    loadChildren: () => import('./content/content.routes').then((r) => r.CONTENT_ROUTES),
  },
  {
    path: 'upload',
    loadComponent: () => import('./content/upload/upload.page').then((p) => p.UploadPage),
  },
  {
    path: 'hashtag-usage',
    loadComponent: () =>
      import('./hashtag-usage/hashtag-usage.page').then((p) => p.HashtagUsagePage),
  },
];
