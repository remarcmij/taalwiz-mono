import { Routes } from '@angular/router';

import { HomePage } from './home.page';

export const homeUrl = '/home/tabs/content';

export const HOME_ROUTES: Routes = [
  {
    path: 'tabs',
    component: HomePage,
    children: [
      {
        path: 'content',
        children: [
          {
            path: '',
            loadChildren: () =>
              import('./content/content.routes').then((r) => r.CONTENT_ROUTES),
          },
        ],
      },
      {
        path: 'dictionary',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./dictionary/dictionary.page').then(
                (p) => p.DictionaryPage,
              ),
            pathMatch: 'full',
          },
          {
            path: ':lang/:word',
            loadComponent: () =>
              import('./dictionary/dictionary.page').then(
                (p) => p.DictionaryPage,
              ),
          },
        ],
      },
      {
        path: 'hashtags',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./content/hashtags/hashtags.page').then(
                (p) => p.HashtagsPage,
              ),
          },
        ],
      },
      {
        path: '',
        redirectTo: homeUrl,
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: homeUrl,
    pathMatch: 'full',
  },
];
