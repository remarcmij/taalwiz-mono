import { apiFetch, ApiError } from '../apiFetch.ts';

describe('apiFetch', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on successful GET', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ data: 'hello' })),
    });

    const result = await apiFetch<{ data: string }>('/api/test');
    expect(result).toEqual({ data: 'hello' });
  });

  it('adds Authorization header when getToken returns a token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({})),
    });

    await apiFetch('/api/test', {
      getToken: async () => 'my-token',
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer my-token');
  });

  it('does not add Authorization header when getToken returns null', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({})),
    });

    await apiFetch('/api/test', {
      getToken: async () => null,
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
  });

  it('does not add Authorization header when no getToken provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({})),
    });

    await apiFetch('/api/test');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
  });

  it('auto-sets Content-Type for string bodies', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({})),
    });

    await apiFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('throws ApiError on non-ok response with status and body', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Invalid credentials' }),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow(ApiError);

    try {
      await apiFetch('/api/test');
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.status).toBe(401);
      expect(apiError.message).toBe('Invalid credentials');
      expect(apiError.body).toEqual({ message: 'Invalid credentials' });
    }
  });

  it('uses statusText when response body has no message', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow('Internal Server Error');
  });

  it('handles json parse error on error response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow('Server Error');
  });

  it('returns undefined for empty response body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });

    const result = await apiFetch('/api/test');
    expect(result).toBeUndefined();
  });

  it('passes fetch options through correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({})),
    });

    await apiFetch('/api/test', { method: 'DELETE' });

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/test');
    expect(options.method).toBe('DELETE');
  });
});
