import type { JwtPayload } from './types/jwtpayload.interface.js';

// Returns the group names a user may access, or null for admins (no restriction).
export function authorizedGroups(user: JwtPayload): string[] | null {
  if (user.roles?.includes('admin')) return null;
  return user.groups ?? [];
}
