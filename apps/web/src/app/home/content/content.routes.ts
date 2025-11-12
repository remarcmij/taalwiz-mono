import { Routes } from '@angular/router';

import { ContentPage } from './content.page';
import { articleResolver } from './publication/article/article.resolver';
import { publicationsIndexResolver } from './publication/publications-index.resolver';

export const CONTENT_ROUTES: Routes = [
  {
    path: '',
    component: ContentPage,
  },
  {
    path: ':groupName',
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./publication/publication.page').then(
            (p) => p.PublicationPage,
          ),
        resolve: { topics: publicationsIndexResolver },
      },
      {
        path: ':filename',
        loadComponent: () =>
          import('./publication/article/article.page').then(
            (p) => p.ArticlePage,
          ),
        resolve: { article: articleResolver },
      },
    ],
  },
];
