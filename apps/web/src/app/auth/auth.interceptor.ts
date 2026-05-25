import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, first, switchMap, throwError } from 'rxjs';

import { LoggerService } from '../shared/logger.service';
import { AuthService } from './auth.service';

const isApiRequest = (req: HttpRequest<unknown>) =>
  req.url.startsWith('/api/v1/');
const isAuthEndpoint = (req: HttpRequest<unknown>) =>
  req.url.startsWith('/api/v1/auth/');

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const logger = inject(LoggerService);
  const label = `authInterceptor ${req.method} ${req.url}`;

  if (isAuthEndpoint(req)) {
    logger.debug(label, 'skip — auth endpoint');
    return next(req);
  }

  if (!isApiRequest(req)) {
    logger.debug(label, 'skip — non-API request');
    return next(req);
  }

  return authService.token.pipe(
    first(),
    switchMap((token) => {
      if (token) {
        logger.debug(label, 'attaching token');
      } else {
        logger.debug(label, 'no token — sending unauthenticated');
      }

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
          logger.debug(label, '401 received — invalidating and refreshing');
          authService.invalidateToken();
          return authService.token.pipe(
            first(),
            switchMap((newToken) => {
              if (!newToken) {
                logger.debug(label, 'refresh failed — logging out');
                authService.logout();
                return throwError(() => error);
              }
              logger.debug(label, 'retrying with refreshed token');
              const retryReq = req.clone({
                headers: req.headers.set('Authorization', `Bearer ${newToken}`),
              });
              return next(retryReq);
            }),
            catchError(() => {
              logger.debug(label, 'retry errored — logging out');
              authService.logout();
              return throwError(() => error);
            }),
          );
        }),
      );
    }),
  );
};
