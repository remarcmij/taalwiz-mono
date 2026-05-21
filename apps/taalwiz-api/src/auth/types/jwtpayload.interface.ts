import { z } from 'zod';

export const JwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.email(),
  lang: z.string().optional(),
  roles: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
  iss: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().optional(),
  nbf: z.number().optional(),
  iat: z.number().optional(),
  jti: z.string().optional(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
