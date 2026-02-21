import type { AuthResponseData, TokenResponseData } from '../types/models.ts';

export async function loginRequest(
  email: string,
  password: string,
): Promise<AuthResponseData> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? res.statusText);
  }
  return res.json() as Promise<AuthResponseData>;
}

export async function refreshTokenRequest(
  refreshToken: string,
): Promise<TokenResponseData> {
  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? res.statusText);
  }
  return res.json() as Promise<TokenResponseData>;
}

export async function validateRegTokenRequest(
  email: string,
  token: string,
): Promise<{ valid: boolean }> {
  const res = await fetch('/api/v1/auth/validate-regtoken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? res.statusText);
  }
  return res.json() as Promise<{ valid: boolean }>;
}

export async function registerRequest(
  email: string,
  password: string,
  name: string,
  token: string,
): Promise<AuthResponseData> {
  const res = await fetch('/api/v1/users/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, token }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? res.statusText);
  }
  return res.json() as Promise<AuthResponseData>;
}

export async function changePasswordRequest(
  email: string,
  password: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch('/api/v1/users/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? res.statusText);
  }
}

export async function requestPasswordResetRequest(
  email: string,
): Promise<void> {
  const res = await fetch('/api/v1/users/request-password-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? res.statusText);
  }
}

export async function resetPasswordRequest(
  newPassword: string,
  token: string,
): Promise<void> {
  const res = await fetch('/api/v1/users/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword, token }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? res.statusText);
  }
}
