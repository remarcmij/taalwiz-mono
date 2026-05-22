import type { Language, Role } from '../../users/models/user.model.js';

export interface AuthResponse {
  id: string;
  email: string;
  name: string;
  lang: Language;
  roles: Role[];
  groups: string[];
  refreshToken: string;
  refreshExp: number;
}

export interface RefreshTokenResponse {
  token: string;
  exp: number;
}
