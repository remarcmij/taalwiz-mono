import assert from 'node:assert/strict';
import { encryptPassword } from '../controllers/auth.controller.js';
import Settings from '../models/settings.model.js';
import User, { IUser } from '../models/user.model.js';
import { loadAsset } from '../util/assetsLoader.js';
import logger from '../util/logger.js';

const seedAdminAccount = async () => {
  assert(process.env.ADMIN_EMAIL);
  const adminEmail = process.env.ADMIN_EMAIL;

  let user = await User.findOne({ email: adminEmail });
  if (!user) {
    assert(process.env.ADMIN_PASSWORD);
    const clearTextPassword = process.env.ADMIN_PASSWORD;

    user = new User({
      role: 'admin',
      name: 'Admin',
      email: adminEmail,
      password: await encryptPassword(clearTextPassword),
      lang: 'en',
    } as IUser);
    await user.save();

    logger.info(`created admin account ${adminEmail}`);
  }

  assert(process.env.DEMO_EMAIL);
  const demoEmail = process.env.DEMO_EMAIL;

  user = await User.findOne({ email: demoEmail });
  if (!user) {
    assert(process.env.DEMO_PASSWORD);
    const clearTextPassword = process.env.DEMO_PASSWORD;

    user = new User({
      role: 'demo',
      name: 'Demo User',
      email: demoEmail,
      password: await encryptPassword(clearTextPassword),
      lang: 'en',
    } as IUser);
    await user.save();

    logger.info(`created demo account ${demoEmail}`);
  }
};

const seedSettings = async () => {
  const exists = await Settings.findOne({});
  if (exists) {
    return;
  }

  const settings = await loadAsset('settings-seed.json');

  await Settings.insertMany(settings);
  logger.info('seeded settings');
};

export const seed = async () => {
  try {
    seedAdminAccount();
    seedSettings();
  } catch (error: any) {
    logger.error('error seeding database:', error);
  }
};
