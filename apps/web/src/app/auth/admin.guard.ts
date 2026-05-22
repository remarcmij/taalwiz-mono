import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, first, map, of, switchMap } from 'rxjs';
import { homeUrl } from '../home/home.routes';
import { LoggerService } from '../shared/logger.service';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const logger = inject(LoggerService);

  return (authGuard(route, state) as Observable<boolean>).pipe(
    switchMap((isAuthenticated) => {
      if (!isAuthenticated) {
        return of(false);
      }
      return authService.user$.pipe(
        first(),
        map((user) => {
          const isAdmin = user?.roles.includes('admin') ?? false;
          if (!isAdmin) {
            logger.warn('adminGuard', 'User is not an admin');
            router.navigateByUrl(homeUrl, { replaceUrl: true });
          }
          return isAdmin;
        })
      );
    })
  );
};
