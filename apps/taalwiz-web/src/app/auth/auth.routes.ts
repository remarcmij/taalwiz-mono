import { Routes } from '@angular/router';

import { AuthPage } from './auth.page';
import { registerGuard } from './register/register.guard';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthPage,
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register.page').then((p) => p.RegisterPage),
    canActivate: [registerGuard],
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./change-password/change-password.page').then(
        (p) => p.ChangePasswordPage,
      ),
  },
  {
    path: 'request-password-reset',
    loadComponent: () =>
      import('./request-password-reset/request-password-reset.page').then(
        (p) => p.RequestPasswordResetPage,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./reset-password/reset-password.page').then(
        (p) => p.ResetPasswordPage,
      ),
  },
];
