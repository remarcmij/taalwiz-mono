import type { IUser } from '../../users/models/user.model.js';

export const seedUsers: Omit<IUser, '_id' | 'created' | 'lastAccessed'>[] = [
  {
    name: 'Admin',
    email: process.env.ADMIN_EMAIL!,
    password: process.env.ADMIN_PASSWORD!,
    lang: 'en',
    roles: ['admin', 'user'],
  },
  {
    name: 'Demo User',
    email: process.env.DEMO_EMAIL!,
    password: process.env.DEMO_PASSWORD!,
    lang: 'nl',
    roles: ['demo'],
  },
];
