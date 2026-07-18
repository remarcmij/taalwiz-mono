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

// Shape of the JSON returned by login/register: the user profile plus the
// long-lived refresh token and its absolute expiry (seconds since epoch, as a
// string). The short-lived access token is fetched separately via /auth/refresh.
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

// Response from /auth/refresh: a fresh short-lived access token and its expiry.
type TokenResponseData = {
  token: string;
  exp: string;
};

// Seconds shaved off every expiry so a token is treated as expired slightly
// early, covering clock skew and request latency to the backend.
const LATENCY_MARGIN = 5;

// In-memory holder for the current access token and its (margin-adjusted)
// expiry. Never persisted — only the refresh token survives a reload.
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

  // Single source of truth for the logged-in user; null means logged out.
  #user$ = new BehaviorSubject<User | null>(null);
  // Signal mirror of #user$ for templates/computed that prefer signals.
  #user = toSignal(this.#user$, { initialValue: null });
  // Current access token, or null until the first refresh.
  #tokenData: TokenData | null = null;
  // Shared refresh request while one is in flight, so concurrent callers
  // (e.g. several HTTP interceptions at once) reuse a single /auth/refresh
  // round-trip instead of each firing their own.
  #refreshInFlight$: Observable<string | null> | null = null;
  // Emits on service teardown to tie off long-lived streams.
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

  // Emits a valid access token for outgoing requests (used by the auth
  // interceptor). Returns the cached token if still fresh, otherwise transparently
  // refreshes. defer() ensures the freshness check runs at subscribe time, not
  // when the getter is called, so each subscription re-evaluates the cache.
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

  // Exchanges the refresh token for a new access token. Guards against a
  // stampede: if a refresh is already running, all callers share it (see
  // #refreshInFlight$ + shareReplay below) rather than hitting /auth/refresh
  // in parallel.
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
          // Clear the in-flight guard once the refresh settles (success, error,
          // or unsubscribe) so the next expiry can start a fresh attempt.
          this.#refreshInFlight$ = null;
        }),
        // Fan the single refresh out to all concurrent subscribers.
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
        // No cached session on this device — treat as logged out.
        if (!storedData || !storedData.value) {
          return { user: null as User | null, landingUrl };
        }
        // Rehydrate a User instance from the persisted JSON (a plain object,
        // so it needs reconstructing to regain the class's methods/getters).
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

  // Emits the current refresh token, or null if logged out or the refresh
  // token itself has expired (forcing a full re-login rather than a refresh).
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

  // Clears the in-memory user and token, drops the persisted session, and
  // sends the user to the login screen.
  logout() {
    this.#user$.next(null);
    this.#tokenData = null;
    Preferences.remove({ key: 'authData' });
    this.#router.navigateByUrl('/auth');
  }

  // Discards the cached access token (but keeps the session) so the next
  // request forces a refresh — used after a 401 from a token the server rejected.
  invalidateToken(): void {
    this.#tokenData = null;
  }

  // Updates the logged-in user's UI language in place after the server PATCH
  // succeeds, then re-persists authData so the change survives the next
  // autoLogin. User is immutable, so a new instance is built rather than mutated.
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

  // Establishes a session from a login/register response: builds the User,
  // pushes it to subscribers, and persists it for autoLogin. Bound and passed
  // to tap() in login()/register().
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

  // Persists the session to Capacitor Preferences so autoLogin can restore it
  // on the next app launch. Only the fields needed to rebuild a User are stored;
  // the access token is deliberately left out (short-lived, re-fetched on demand).
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
