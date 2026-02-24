import { renderHook } from '@testing-library/react';
import { useAuth } from '../useAuth.ts';
import { AuthContext, type AuthContextValue } from '../../context/AuthContext.tsx';
import type { ReactNode } from 'react';

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress console.error for expected error
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    vi.restoreAllMocks();
  });

  it('returns context value within provider', () => {
    const mockValue: AuthContextValue = {
      user: null,
      initialized: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn(),
      isAdmin: false,
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={mockValue}>{children}</AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current).toBe(mockValue);
  });

  it('returns all expected properties', () => {
    const mockValue: AuthContextValue = {
      user: null,
      initialized: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      getAccessToken: vi.fn(),
      isAdmin: false,
    };

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={mockValue}>{children}</AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('initialized');
    expect(result.current).toHaveProperty('login');
    expect(result.current).toHaveProperty('register');
    expect(result.current).toHaveProperty('logout');
    expect(result.current).toHaveProperty('getAccessToken');
    expect(result.current).toHaveProperty('isAdmin');
  });
});
