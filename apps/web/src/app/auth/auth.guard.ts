import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of, tap } from 'rxjs';
import { LoggerService } from '../shared/logger.service';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  const obs$ = authService.user() ? of(true) : authService.autoLogin();
  return obs$.pipe(
    tap((isAuthenticated) => {
      if (!isAuthenticated) {
        logger.warn('authGuard', 'User is not authenticated');
        router.navigateByUrl('/auth');
      }
    }),
  );
};
