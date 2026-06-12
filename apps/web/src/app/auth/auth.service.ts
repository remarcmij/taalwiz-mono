import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';

import { Preferences } from '@capacitor/preferences';

import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  defer,
  finalize,
  from,
  map,
  of,
  shareReplay,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs';

import { toSignal } from '@angular/core/rxjs-interop';
import { HOME_TABS, HomeTab, LAST_TAB_KEY, homeUrl, tabUrl } from '../home/home.routes';
import { LoggerService } from '../shared/logger.service';
import { Role, User } from './user.model';

export interface AuthResponseData {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  groups: string[];
  lang: string;
  refreshToken: string;
  refreshExp: string;
}

type TokenResponseData = {
  token: string;
  exp: string;
};

const LATENCY_MARGIN = 5;

class TokenData {
  constructor(
    public token: string,
    public exp: number,
  ) {}
}

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  #http = inject(HttpClient);
  #router = inject(Router);
  #logger = inject(LoggerService);

  #user$ = new BehaviorSubject<User | null>(null);
  #user = toSignal(this.#user$, { initialValue: null });
  #tokenData: TokenData | null = null;
  #refreshInFlight$: Observable<string | null> | null = null;
  #destroy$ = new Subject<void>();

  constructor() {
    this.#user$.subscribe((user) => {
      if (user) {
        this.#logger.debug(
          'AuthService',
          `user ${user.email} logged in as ${user.roles} using language ${user.lang}.`,
        );
      }
    });
  }

  ngOnDestroy(): void {
    this.#destroy$.next();
    this.#destroy$.complete();
  }

  get user$() {
    return this.#user$.asObservable();
  }

  get user() {
    return this.#user;
  }

  get token() {
    return defer(() => {
      if (this.#tokenData && this.#tokenData.exp > new Date().getTime() / 1000) {
        return of(this.#tokenData.token);
      }
      return this.#getRefreshedToken();
    }).pipe(
      catchError((error: unknown) => {
        // Only a genuine rejection of the refresh token (HTTP 401/403) ends the
        // session. Transient failures — server unreachable (status 0), timeouts,
        // or 5xx — must NOT log the user out: returning null fails just this
        // request, leaving the session intact so the next attempt can recover.
        if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
          this.#logger.warn('AuthService', 'Refresh token rejected; logging out', error);
          this.logout();
        } else {
          this.#logger.error('AuthService', 'Token refresh failed (transient); keeping session', error);
        }
        return of(null);
      }),
      takeUntil(this.#destroy$),
    );
  }

  #getRefreshedToken(): Observable<string | null> {
    if (!this.#refreshInFlight$) {
      this.#refreshInFlight$ = this.refreshToken.pipe(
        take(1),
        switchMap((refreshToken) => {
          if (!refreshToken) {
            // No valid refresh token left (missing or client-side expired).
            // Only end the session if there actually is one: a public request
            // made while logged out (e.g. registration or password reset) also
            // routes through this interceptor and lands here, and calling
            // logout() then would spuriously redirect to /auth — the login
            // screen that briefly appeared under the registration welcome alert.
            if (this.#user$.value) {
              this.logout();
            }
            return of(null);
          }
          return this.#http
            .post<TokenResponseData>('/api/v1/auth/refresh', { refreshToken })
            .pipe(
              map((tokenData) => {
                // Add a safety margin to allow for backend latency.
                this.#tokenData = new TokenData(tokenData.token, +tokenData.exp - LATENCY_MARGIN);
                this.#logger.debug('AuthService', 'token refreshed');
                return tokenData.token;
              }),
            );
        }),
        finalize(() => {
          this.#refreshInFlight$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
    }
    return this.#refreshInFlight$;
  }

  // restoreTab is true only on a cold start (via the auth guard): the app then
  // reopens the tab the user left off on. On a resume re-auth it is false, so
  // autoLogin re-validates the session without hijacking the current route.
  autoLogin(restoreTab = false) {
    return from(Preferences.get({ key: LAST_TAB_KEY })).pipe(
      map(({ value }) => {
        const isTab = !!value && (HOME_TABS as readonly string[]).includes(value);
        return isTab ? tabUrl(value as HomeTab) : homeUrl;
      }),
      switchMap((landingUrl) =>
        from(Preferences.get({ key: 'authData' })).pipe(
          map((storedData) => ({ landingUrl, storedData })),
        ),
      ),
      map(({ landingUrl, storedData }) => {
        if (!storedData || !storedData.value) {
          return { user: null as User | null, landingUrl };
        }
        const parsedData = JSON.parse(storedData.value) as User;

        const user = new User(
          parsedData.id,
          parsedData.email,
          parsedData.name,
          parsedData.lang,
          parsedData.roles,
          parsedData.groups ?? [],
          parsedData.refreshToken,
          +parsedData.refreshExp,
        );
        if (parsedData.name) {
          user.name = parsedData.name;
        }
        return { user, landingUrl };
      }),
      tap(({ user, landingUrl }) => {
        if (user) {
          this.#user$.next(user);
          if (restoreTab) {
            this.#router.navigateByUrl(landingUrl);
          }
        }
      }),
      map(({ user }) => !!user),
    );
  }

  get refreshToken() {
    return this.#user$.asObservable().pipe(
      map((user) => {
        if (!user) {
          return null;
        }
        // Return the refresh token if it is still valid, otherwise return null.
        return user.refreshExp < new Date().getTime() / 1000 ? null : user.refreshToken;
      }),
    );
  }

  register(email: string, password: string, name: string, token: string) {
    return this.#http
      .post<AuthResponseData>('/api/v1/users/register', {
        email,
        password,
        name,
        token,
      })
      .pipe(tap(this.#setUserData.bind(this)));
  }

  login(email: string, password: string) {
    return this.#http
      .post<AuthResponseData>('/api/v1/auth/login', {
        email,
        password,
      })
      .pipe(tap(this.#setUserData.bind(this)));
  }

  changePassword(email: string, password: string, newPassword: string) {
    return this.#http.post('/api/v1/users/change-password', {
      email,
      password,
      newPassword,
    });
  }

  requestPasswordReset(email: string) {
    return this.#http.post('/api/v1/users/request-password-reset', { email });
  }

  resetPassword(newPassword: string, token: string) {
    return this.#http.post('/api/v1/users/reset-password', {
      newPassword,
      token,
    });
  }

  logout() {
    this.#user$.next(null);
    this.#tokenData = null;
    Preferences.remove({ key: 'authData' });
    this.#router.navigateByUrl('/auth');
  }

  invalidateToken(): void {
    this.#tokenData = null;
  }

  applyLangToCurrentUser(lang: string): void {
    const current = this.#user$.value;
    if (!current) return;
    const updated = new User(
      current.id,
      current.email,
      current.name,
      lang,
      current.roles,
      current.groups,
      current.refreshToken,
      current.refreshExp,
      current.created,
      current.lastAccessed,
      current.isSuspended,
    );
    this.#user$.next(updated);
    void this.#storeAuthData(
      current.id,
      current.email,
      current.name,
      lang,
      current.roles,
      current.refreshToken,
      current.refreshExp,
    );
  }

  #setUserData(userData: AuthResponseData) {
    const refreshExp = +userData.refreshExp - LATENCY_MARGIN;
    const user = new User(
      userData.id,
      userData.email,
      userData.name,
      userData.lang,
      userData.roles,
      userData.groups ?? [],
      userData.refreshToken,
      refreshExp,
    );

    this.#user$.next(user);

    this.#storeAuthData(
      userData.id,
      userData.email,
      userData.name,
      userData.lang,
      userData.roles,
      userData.refreshToken,
      refreshExp,
    );
  }

  async #storeAuthData(
    id: string,
    email: string,
    name: string,
    lang: string,
    roles: Role[],
    refreshToken: string,
    refreshExp: number,
  ) {
    const data = JSON.stringify({
      id,
      email,
      name,
      lang,
      roles,
      refreshToken,
      refreshExp,
    });
    await Preferences.set({ key: 'authData', value: data });
  }
}
