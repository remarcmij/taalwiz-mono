// The headword (target) language — fixed for both dictionaries (Indonesian).
// The native (gloss) language is NOT here: it varies per deployment (nl for
// Teeuw, en for Stevens) and is baked into the web bundle at build time from
// `NATIVE_LANG` (see apps/web/scripts/generate-deployment.mjs).
export const TARGET_LANG = 'id';

export const MIN_PASSWORD_LENGTH = 6;

export const AUTH_FAILED = 'AUTH_FAILED';
export const ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED';
export const DEMO_ACCOUNT = 'DEMO_ACCOUNT';
export const EMAIL_EXISTS = 'EMAIL_EXISTS';
export const EMAIL_MISMATCH = 'EMAIL_MISMATCH';
export const EMAIL_NOT_FOUND = 'EMAIL_NOT_FOUND';
export const TOKEN_EXPIRED = 'TOKEN_EXPIRED';
export const TOKEN_INVALID = 'TOKEN_INVALID';
