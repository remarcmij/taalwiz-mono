import { Routes } from '@angular/router';

import { articleResolver } from '../../home/content/publication/article/article.resolver';
import { ContentPage } from './content.page';

export const CONTENT_ROUTES: Routes = [
  {
    path: '',
    component: ContentPage,
  },
  {
    path: 'article/:filename',
    loadComponent: () =>
      import('./publication/article/article.page').then((p) => p.ArticlePage),
    resolve: { article: articleResolver },
  },
  {
    path: ':groupName',
    loadComponent: () =>
      import('./publication/publication.page').then((p) => p.PublicationPage),
  },
];
