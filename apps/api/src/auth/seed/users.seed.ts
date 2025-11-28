import type { UserDoc } from '../../users/models/user.model.js';
import { EnvDto } from '../../util/env.dto.js';

const env = EnvDto.getInstance();

export const seedUsers: Omit<UserDoc, '_id' | 'created' | 'lastAccessed'>[] = [
  {
    name: 'Admin',
    email: env.adminEmail!,
    password: env.adminPassword,
    lang: 'en',
    roles: ['admin', 'user'],
  },
  {
    name: 'Demo User',
    email: env.demoEmail!,
    password: env.demoPassword,
    lang: 'nl',
    roles: ['demo'],
  },
];
