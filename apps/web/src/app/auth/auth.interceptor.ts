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
              // The token getter is the single authority on logout: it has
              // already ended the session if the refresh was genuinely rejected
              // (401/403) or the refresh token expired. A null token for any
              // other reason is transient, so we just fail this request rather
              // than tearing down the session.
              if (!newToken) {
                return throwError(() => error);
              }
              const retryReq = req.clone({
                headers: req.headers.set('Authorization', `Bearer ${newToken}`),
              });
              return next(retryReq);
            }),
          );
        }),
      );
    }),
  );
};
