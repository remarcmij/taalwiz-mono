import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, AuthContext } from '../AuthContext.tsx';
import { useContext, type ReactNode } from 'react';

// Mock dependencies
vi.mock('../../api/auth.api.ts', () => ({
  loginRequest: vi.fn(),
  refreshTokenRequest: vi.fn(),
  registerRequest: vi.fn(),
}));

vi.mock('../../lib/i18n.ts', () => ({
  default: { changeLanguage: vi.fn() },
}));

vi.mock('../../lib/logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  loginRequest,
  refreshTokenRequest,
  registerRequest,
} from '../../api/auth.api.ts';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };
}

function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('No context');
  return context;
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('has null user when no localStorage data', () => {
    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });
    expect(result.current.user).toBeNull();
    expect(result.current.initialized).toBe(true);
  });

  it('restores user from valid localStorage', () => {
    localStorage.setItem(
      'authData',
      JSON.stringify({
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        lang: 'nl',
        roles: ['user'],
        refreshToken: 'rt',
        refreshExp: Date.now() / 1000 + 3600,
      }),
    );

    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.user).not.toBeNull();
    expect(result.current.user!.email).toBe('test@test.com');
  });

  it('handles invalid localStorage JSON gracefully', () => {
    localStorage.setItem('authData', 'not-valid-json');

    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });
    expect(result.current.user).toBeNull();
    expect(result.current.initialized).toBe(true);
  });

  it('login calls API, sets user, saves to localStorage', async () => {
    vi.mocked(loginRequest).mockResolvedValue({
      id: '1',
      email: 'test@test.com',
      name: 'Test',
      roles: ['user'],
      lang: 'nl',
      refreshToken: 'rt',
      refreshExp: String(Date.now() / 1000 + 3600),
    });

    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.login('test@test.com', 'password');
    });

    expect(loginRequest).toHaveBeenCalledWith('test@test.com', 'password');
    expect(result.current.user).not.toBeNull();
    expect(result.current.user!.email).toBe('test@test.com');
    expect(localStorage.getItem('authData')).not.toBeNull();
  });

  it('login surfaces API errors', async () => {
    vi.mocked(loginRequest).mockRejectedValue(new Error('Invalid credentials'));

    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.login('test@test.com', 'wrong');
      }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('register calls API and sets user', async () => {
    vi.mocked(registerRequest).mockResolvedValue({
      id: '2',
      email: 'new@test.com',
      name: 'New',
      roles: ['user'],
      lang: 'nl',
      refreshToken: 'rt2',
      refreshExp: String(Date.now() / 1000 + 3600),
    });

    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.register('new@test.com', 'pass', 'New', 'token');
    });

    expect(registerRequest).toHaveBeenCalledWith(
      'new@test.com',
      'pass',
      'New',
      'token',
    );
    expect(result.current.user!.email).toBe('new@test.com');
  });

  it('logout clears user and localStorage', async () => {
    vi.mocked(loginRequest).mockResolvedValue({
      id: '1',
      email: 'test@test.com',
      name: 'Test',
      roles: ['user'],
      lang: 'nl',
      refreshToken: 'rt',
      refreshExp: String(Date.now() / 1000 + 3600),
    });

    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.login('test@test.com', 'pass');
    });
    expect(result.current.user).not.toBeNull();

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('authData')).toBeNull();
  });

  it('isAdmin is true when user has admin role', () => {
    localStorage.setItem(
      'authData',
      JSON.stringify({
        id: '1',
        email: 'admin@test.com',
        name: 'Admin',
        lang: 'nl',
        roles: ['admin', 'user'],
        refreshToken: 'rt',
        refreshExp: Date.now() / 1000 + 3600,
      }),
    );

    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isAdmin).toBe(true);
  });

  it('isAdmin is false for regular user', () => {
    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isAdmin).toBe(false);
  });

  it('getAccessToken returns null when no auth data', async () => {
    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });

    const token = await result.current.getAccessToken();
    expect(token).toBeNull();
  });

  it('getAccessToken refreshes expired token', async () => {
    localStorage.setItem(
      'authData',
      JSON.stringify({
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        lang: 'nl',
        roles: ['user'],
        refreshToken: 'rt',
        refreshExp: Date.now() / 1000 + 3600,
      }),
    );

    vi.mocked(refreshTokenRequest).mockResolvedValue({
      token: 'new-access-token',
      exp: String(Date.now() / 1000 + 600),
    });

    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });

    let token: string | null = null;
    await act(async () => {
      token = await result.current.getAccessToken();
    });

    expect(refreshTokenRequest).toHaveBeenCalledWith('rt');
    expect(token).toBe('new-access-token');
  });

  it('getAccessToken logs out when refresh token is expired', async () => {
    localStorage.setItem(
      'authData',
      JSON.stringify({
        id: '1',
        email: 'test@test.com',
        name: 'Test',
        lang: 'nl',
        roles: ['user'],
        refreshToken: 'rt',
        refreshExp: Date.now() / 1000 - 100, // expired
      }),
    );

    const { result } = renderHook(() => useAuthContext(), {
      wrapper: createWrapper(),
    });

    let token: string | null = null;
    await act(async () => {
      token = await result.current.getAccessToken();
    });

    expect(token).toBeNull();
    expect(result.current.user).toBeNull();
  });
});
