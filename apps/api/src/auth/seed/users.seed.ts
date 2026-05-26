import type { ConfigService } from '@nestjs/config';
import type { UserDoc } from '../../users/models/user.model.js';
import type { EnvDto } from '../../util/env.dto.js';

export function getSeedUsers(
  config: ConfigService<EnvDto, true>,
): Omit<UserDoc, '_id' | 'created' | 'lastAccessed' | 'isSuspended'>[] {
  return [
    {
      name: 'Admin',
      email: config.get('ADMIN_EMAIL'),
      password: config.get('ADMIN_PASSWORD'),
      lang: 'en',
      roles: ['admin', 'user'],
      groups: [],
    },
    {
      name: 'Demo User',
      email: config.get('DEMO_EMAIL'),
      password: config.get('DEMO_PASSWORD'),
      lang: 'nl',
      roles: ['demo'],
      groups: [],
    },
  ];
}
