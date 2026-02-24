import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery.ts';

describe('useMediaQuery', () => {
  let listeners: Map<string, (e: MediaQueryListEvent) => void>;
  let mediaQueryState: Map<string, boolean>;

  beforeEach(() => {
    listeners = new Map();
    mediaQueryState = new Map();

    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: mediaQueryState.get(query) ?? false,
      media: query,
      addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
        listeners.set(query, handler);
      },
      removeEventListener: (_event: string, _handler: (e: MediaQueryListEvent) => void) => {
        listeners.delete(query);
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when query does not match initially', () => {
    mediaQueryState.set('(min-width: 768px)', false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('returns true when query matches initially', () => {
    mediaQueryState.set('(min-width: 768px)', true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates on change event', () => {
    mediaQueryState.set('(min-width: 768px)', false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    act(() => {
      const handler = listeners.get('(min-width: 768px)');
      handler?.({ matches: true } as MediaQueryListEvent);
    });

    expect(result.current).toBe(true);
  });

  it('cleans up listener on unmount', () => {
    mediaQueryState.set('(min-width: 768px)', false);
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(listeners.has('(min-width: 768px)')).toBe(true);

    unmount();
    expect(listeners.has('(min-width: 768px)')).toBe(false);
  });

  it('re-subscribes when query changes', () => {
    mediaQueryState.set('(min-width: 768px)', true);
    mediaQueryState.set('(min-width: 1024px)', false);

    const { result, rerender } = renderHook(
      ({ query }) => useMediaQuery(query),
      { initialProps: { query: '(min-width: 768px)' } },
    );
    expect(result.current).toBe(true);

    rerender({ query: '(min-width: 1024px)' });
    expect(result.current).toBe(false);
    expect(listeners.has('(min-width: 1024px)')).toBe(true);
  });
});
