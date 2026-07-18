import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, first, switchMap, throwError } from 'rxjs';

import { AuthService } from './auth.service';

// Only same-origin API calls carry a bearer token. Auth endpoints are the
// public subset of the API (login, refresh, validate-regtoken) that must NOT
// be authenticated — see the guard below.
const isApiRequest = (req: HttpRequest<unknown>) => req.url.startsWith('/api/v1/');
const isAuthEndpoint = (req: HttpRequest<unknown>) => req.url.startsWith('/api/v1/auth/');

// Attaches the access token to outgoing API requests and transparently refreshes
// it once on a 401. The AuthService.token getter owns all refresh/logout policy;
// this interceptor is only the HTTP mechanism that wires it into the request flow.
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

  // Resolve a token first (may refresh proactively if the cached one expired),
  // then send the request. first() completes the stream so it never leaks a
  // long-lived subscription to the user/token observables.
  return authService.token.pipe(
    first(),
    switchMap((token) => {
      // A null token (transient refresh failure, or logged out) sends the
      // request unauthenticated; the server's 401 then drives the retry below.
      const authedReq = token
        ? req.clone({
            headers: req.headers.set('Authorization', `Bearer ${token}`),
          })
        : req;

      return next(authedReq).pipe(
        catchError((error: HttpErrorResponse) => {
          // Only 401 (token rejected) is recoverable here; anything else is the
          // caller's problem and propagates untouched.
          if (error.status !== 401) {
            return throwError(() => error);
          }
          // The server rejected this token even though the client thought it
          // was fresh (early revocation, clock skew). Drop the cache and force
          // a single refresh + retry.
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
              // Retry once with the refreshed token. This retry is NOT wrapped
              // in the same catchError, so a second 401 propagates instead of
              // looping.
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
