import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, first, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

const isApiRequest = (req: HttpRequest<unknown>) => req.url.startsWith('/api/v1/');
const isAuthEndpoint = (req: HttpRequest<unknown>) => req.url.startsWith('/api/v1/auth/');

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Auth endpoints (login, refresh, validate-regtoken) are public; routing
  // /auth/refresh back through this interceptor would recurse via the token
  // getter.
  if (isAuthEndpoint(req)) {
    return next(req);
  }

  // Non-API traffic (i18n files, static assets) gets no Authorization header.
  if (!isApiRequest(req)) {
    return next(req);
  }

  return authService.token.pipe(
    first(),
    switchMap((token) => {
      const authedReq = token
        ? req.clone({
            headers: req.headers.set('Authorization', `Bearer ${token}`),
          })
        : req;

      return next(authedReq).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status !== 401) {
            return throwError(() => error);
          }
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
    }),
  );
};
