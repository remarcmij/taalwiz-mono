import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  loginRequest,
  refreshTokenRequest,
  registerRequest,
} from '../api/auth.api.ts';
import i18n from '../lib/i18n.ts';
import { logger } from '../lib/logger.ts';
import { User, type AuthResponseData, type Role } from '../types/models.ts';

const LATENCY_MARGIN = 5;
const AUTH_DATA_KEY = 'authData';
const LAST_URL_KEY = 'lastUrl';
export const HOME_URL = '/home/tabs/content';

// --- State ---

interface AuthState {
  user: User | null;
  initialized: boolean;
}

type AuthAction =
  | { type: 'SET_USER'; user: User | null }
  | { type: 'INITIALIZED' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.user };
    case 'INITIALIZED':
      return { ...state, initialized: true };
    default:
      return state;
  }
}

/** Read stored auth data synchronously to provide initial state */
function getInitialState(): AuthState {
  try {
    const storedData = localStorage.getItem(AUTH_DATA_KEY);
    if (!storedData) return { user: null, initialized: true };

    const parsed = JSON.parse(storedData) as {
      id: string;
      email: string;
      name: string;
      lang: string;
      roles: Role[];
      refreshToken: string;
      refreshExp: number;
    };

    const user = new User(
      parsed.id,
      parsed.email,
      parsed.name,
      parsed.lang,
      parsed.roles,
      parsed.refreshToken,
      +parsed.refreshExp,
    );

    const lastUrl = localStorage.getItem(LAST_URL_KEY) ?? HOME_URL;
    logger.debug('AuthContext', `autoLogin successful, lastUrl: ${lastUrl}`);

    return { user, initialized: true };
  } catch {
    return { user: null, initialized: true };
  }
}

// --- Context ---

export interface AuthContextValue {
  user: User | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    token: string,
  ) => Promise<void>;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
  isAdmin: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

// --- Provider ---

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(authReducer, undefined, getInitialState);
  const tokenRef = useRef<{ token: string; exp: number } | null>(null);
  const queryClient = useQueryClient();

  // Set language when user changes
  useEffect(() => {
    if (state.user) {
      i18n.changeLanguage(state.user.lang);
      logger.debug(
        'AuthContext',
        `user ${state.user.email} logged in as ${state.user.roles} using language ${state.user.lang}.`,
      );
    }
  }, [state.user]);

  const setUserData = useCallback((data: AuthResponseData) => {
    const refreshExp = +data.refreshExp - LATENCY_MARGIN;
    const user = new User(
      data.id,
      data.email,
      data.name,
      data.lang,
      data.roles,
      data.refreshToken,
      refreshExp,
    );
    dispatch({ type: 'SET_USER', user });
    storeAuthData(
      data.id,
      data.email,
      data.name,
      data.lang,
      data.roles,
      data.refreshToken,
      refreshExp,
    );
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginRequest(email, password);
      setUserData(data);
    },
    [setUserData],
  );

  const register = useCallback(
    async (email: string, password: string, name: string, token: string) => {
      const data = await registerRequest(email, password, name, token);
      setUserData(data);
    },
    [setUserData],
  );

  const logout = useCallback(() => {
    dispatch({ type: 'SET_USER', user: null });
    tokenRef.current = null;
    localStorage.removeItem(AUTH_DATA_KEY);
    queryClient.clear();
    i18n.changeLanguage('nl');
  }, [queryClient]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    // Check if current token is still valid
    if (tokenRef.current) {
      if (tokenRef.current.exp > Date.now() / 1000) {
        return tokenRef.current.token;
      }
    }

    // Need to refresh — get refresh token from current user
    const storedData = localStorage.getItem(AUTH_DATA_KEY);
    if (!storedData) return null;

    const parsed = JSON.parse(storedData) as {
      refreshToken?: string;
      refreshExp?: number;
    };
    if (!parsed.refreshToken) return null;

    // Check if refresh token is still valid
    if (parsed.refreshExp && parsed.refreshExp < Date.now() / 1000) {
      logout();
      return null;
    }

    try {
      const tokenData = await refreshTokenRequest(parsed.refreshToken);
      const newToken = {
        token: tokenData.token,
        exp: +tokenData.exp - LATENCY_MARGIN,
      };
      tokenRef.current = newToken;
      logger.debug('AuthContext', 'token refreshed');
      return tokenData.token;
    } catch (error) {
      logger.error('AuthContext', 'Token refresh failed', error);
      logout();
      return null;
    }
  }, [logout]);

  const isAdmin = useMemo(
    () => state.user?.roles.includes('admin') ?? false,
    [state.user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.user,
      initialized: state.initialized,
      login,
      register,
      logout,
      getAccessToken,
      isAdmin,
    }),
    [
      state.user,
      state.initialized,
      login,
      register,
      logout,
      getAccessToken,
      isAdmin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// --- Helpers ---

function storeAuthData(
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
  localStorage.setItem(AUTH_DATA_KEY, data);
}
