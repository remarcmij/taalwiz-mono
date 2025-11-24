export interface JwtPayload {
  sub: string;
  email: string;
  lang?: string;
  roles: string[];
  iss?: string | undefined;
  aud?: string | string[] | undefined;
  exp?: number | undefined;
  nbf?: number | undefined;
  iat?: number | undefined;
  jti?: string | undefined;
}
