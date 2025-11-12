import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { LoggerService } from '../../shared/logger.service';

export const registerGuard: CanActivateFn = (route, state) => {
  const http = inject(HttpClient);
  const router = inject(Router);
  const logger = inject(LoggerService);

  const email = route.queryParamMap.get('email');
  const token = route.queryParamMap.get('token');
  if (!email || !token) {
    of(false);
  }
  return http
    .get(`/auth-api/validate-regtoken?email=${email}&token=${token}`)
    .pipe(
      map(() => true),
      catchError(() => {
        logger.warn('registerGuard', 'Invalid registration token');
        router.navigateByUrl('/auth');
        return of(false);
      }),
    );
};
