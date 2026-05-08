import { Routes } from '@angular/router';
import { adminGuard } from './auth/admin.guard';
import { authGuard } from './auth/auth.guard';
import { articleResolver } from './home/content/publication/article/article.resolver';

export const APP_ROUTES: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then((r) => r.AUTH_ROUTES),
  },
  {
    path: 'home',
    loadChildren: () => import('./home/home.routes').then((r) => r.HOME_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'flashcard/:filename',
    loadComponent: () =>
      import('./flashcard/flashcard.page').then((p) => p.FlashcardPage),
    canActivate: [authGuard],
    resolve: { article: articleResolver },
  },
  {
    path: 'welcome/:lang',
    loadComponent: () =>
      import('./user/welcome/welcome.page').then((p) => p.WelcomePage),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./admin/admin.routes').then((r) => r.ADMIN_ROUTES),
    canActivate: [adminGuard],
  },
  {
    path: 'about/:lang',
    loadComponent: () => import('./about/about.page').then((m) => m.AboutPage),
    canActivate: [authGuard],
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./user/contact/contact.page').then((p) => p.ContactPage),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'auth' },
];
