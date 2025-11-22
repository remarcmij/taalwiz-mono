import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { Preferences } from '@capacitor/preferences';

import { TranslateService } from '@ngx-translate/core';

import {
  BehaviorSubject,
  Subject,
  catchError,
  first,
  from,
  map,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

import { toSignal } from '@angular/core/rxjs-interop';
import { homeUrl } from '../home/home.routes';
import { LoggerService } from '../shared/logger.service';
import { Role, User } from './user.model';

export interface AuthResponseData {
  id: string;
  email: string;
  name: string;
  roles: Role[];
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
    public exp: number
  ) {}
}

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  #user$ = new BehaviorSubject<User | null>(null);
  #user = toSignal(this.#user$, { initialValue: null });
  #tokenData$ = new BehaviorSubject<TokenData | null>(null);
  #destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private router: Router,
    private translate: TranslateService,
    private logger: LoggerService
  ) {
    this.#user$.subscribe((user) => {
      if (user) {
        this.translate.use(user.lang);
        logger.debug(
          'AuthService',
          `user ${user.email} logged in as ${user.roles} using language ${user.lang}.`
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
    return this.#tokenData$.asObservable().pipe(
      switchMap((tokenData) => {
        if (tokenData) {
          // Check if the token is still valid.
          if (tokenData.exp > new Date().getTime() / 1000) {
            return of(tokenData.token);
          }
        }

        // There is no valid token, so we need to get a new one using the refresh token.
        return this.refreshToken.pipe(
          switchMap((refreshToken) => {
            if (!refreshToken) {
              // There is no refresh token, so we can't get a new token.
              return of(null);
            }
            return this.http
              .post<TokenResponseData>('/api/v1/auth/refresh', { refreshToken })
              .pipe(
                switchMap((tokenData) => {
                  // Add a safety margin to allow for backend latency.
                  const newTokenData = new TokenData(
                    tokenData.token,
                    +tokenData.exp - LATENCY_MARGIN
                  );
                  this.#tokenData$.next(newTokenData);
                  this.logger.debug('AuthService', 'token refreshed');
                  return of(tokenData.token);
                })
              );
          })
        );
      }),
      catchError((error) => {
        this.logger.error('AuthService', 'Token retrieval failed', error);
        this.logout();
        return of(null);
      }),
      takeUntil(this.#destroy$)
    );
  }

  getRequestHeaders({ json } = { json: false }) {
    let headers = new HttpHeaders();
    if (json) {
      headers = headers.set('Content-Type', 'application/json');
    }
    return this.token.pipe(
      first(),
      switchMap((token) => {
        if (!token) {
          throw new Error('No access token available');
        }
        headers = headers.set('Authorization', 'Bearer ' + token);
        return of(headers);
      }),
      catchError((error) => {
        this.logger.error(
          'AuthService',
          'Request headers retrieval failed',
          error
        );
        this.logout();
        return of(headers);
      })
    );
  }

  requestHeaders$ = this.token.pipe(
    first(),
    switchMap((token) => {
      if (!token) {
        throw new Error('No access token available');
      }
      const headers = new HttpHeaders({ Authorization: 'Bearer ' + token });
      return of(headers);
    }),
    catchError(() => {
      this.logout();
      return of(null);
    })
  );

  autoLogin() {
    let lastUrl = homeUrl;
    return from(Preferences.get({ key: 'lastUrl' })).pipe(
      map((value) => {
        if (value && value.value) {
          lastUrl = value.value;
          this.logger.debug('AuthService', `lastUrl: ${lastUrl}`);
        }
      }),
      switchMap(() => from(Preferences.get({ key: 'authData' }))),
      map((storedData) => {
        if (!storedData || !storedData.value) {
          return null;
        }
        const parsedData = JSON.parse(storedData.value) as User;

        const user = new User(
          parsedData.id,
          parsedData.email,
          parsedData.name,
          parsedData.lang,
          parsedData.roles,
          parsedData.refreshToken,
          +parsedData.refreshExp
        );
        if (parsedData.name) {
          user.name = parsedData.name;
        }
        return user;
      }),
      tap((user) => {
        if (user) {
          this.#user$.next(user);
          this.router.navigateByUrl(lastUrl);
        }
      }),
      map((user) => {
        return !!user;
      })
    );
  }

  get refreshToken() {
    return this.#user$.asObservable().pipe(
      map((user) => {
        if (!user) {
          return null;
        }
        // Return the refresh token if it is still valid, otherwise return null.
        return user.refreshExp < new Date().getTime() / 1000
          ? null
          : user.refreshToken;
      })
    );
  }

  register(email: string, password: string, name: string, token: string) {
    return this.http
      .post<AuthResponseData>('/auth-api/register', {
        email,
        password,
        name,
        token,
      })
      .pipe(tap(this.setUserData.bind(this)));
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponseData>('/api/v1/auth/login', {
        email,
        password,
      })
      .pipe(tap(this.setUserData.bind(this)));
  }

  changePassword(email: string, password: string, newPassword: string) {
    return this.http.post('/auth-api/change-password', {
      email,
      password,
      newPassword,
    });
  }

  requestPasswordReset(email: string) {
    return this.http.post('/auth-api/request-password-reset', { email });
  }

  resetPassword(newPassword: string, token: string) {
    return this.http.post('/auth-api/reset-password', { newPassword, token });
  }

  logout() {
    this.#user$.next(null);
    this.#tokenData$.next(null);
    Preferences.remove({ key: 'authData' });
  }

  private setUserData(userData: AuthResponseData) {
    const refreshExp = +userData.refreshExp - LATENCY_MARGIN;
    const user = new User(
      userData.id,
      userData.email,
      userData.name,
      userData.lang,
      userData.roles,
      userData.refreshToken,
      refreshExp
    );

    this.#user$.next(user);

    this.storeAuthData(
      userData.id,
      userData.email,
      userData.name,
      userData.lang,
      userData.roles,
      userData.refreshToken,
      refreshExp
    );
  }

  private async storeAuthData(
    id: string,
    email: string,
    name: string,
    lang: string,
    roles: Role[],
    refreshToken: string,
    refreshExp: number
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
