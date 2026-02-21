export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit & { getToken?: () => Promise<string | null> } = {},
): Promise<T> {
  const { getToken, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  if (getToken) {
    const token = await getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  if (
    fetchOptions.body &&
    typeof fetchOptions.body === 'string' &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...fetchOptions, headers });

  if (!response.ok) {
    let body: Record<string, unknown> | undefined;
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      // ignore json parse errors
    }
    throw new ApiError(
      (body?.message as string) ?? response.statusText,
      response.status,
      body,
    );
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
