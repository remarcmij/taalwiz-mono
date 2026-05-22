import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, first, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Don't retry auth-endpoint calls — avoids infinite refresh loop.
  if (req.url.includes('/api/v1/auth/')) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }
      // Discard the cached token so the getter calls the refresh endpoint.
      authService.invalidateToken();
      return authService.token.pipe(
        first(),
        switchMap((newToken) => {
          if (!newToken) {
            authService.logout();
            return throwError(() => error);
          }
          const retryReq = req.clone({
            headers: req.headers.set('Authorization', `Bearer ${newToken}`),
          });
          return next(retryReq);
        }),
        catchError(() => {
          authService.logout();
          return throwError(() => error);
        }),
      );
    }),
  );
};
