import type { Request, Response } from 'express';
import { body, param, query } from 'express-validator';
import jwt, { JwtPayload } from 'jsonwebtoken';
import assert from 'node:assert/strict';

import Settings, { ISetting } from '../models/settings.model.js';
import User from '../models/user.model.js';
import {
  EMAIL_EXISTS,
  EMAIL_MISMATCH,
  OK,
  TOKEN_INVALID,
  USER_NOT_FOUND,
} from '../shared/shared.js';
import { loadAsset } from '../util/assetsLoader.js';
import emailTransporter from '../util/email-transporter.js';
import logger from '../util/logger.js';

export const userValidations = () => [
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
];

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find({}).sort('email').select('-password').lean();
    res.status(200).json(users);
    logger.debug(`getUsers: ${users.length}`);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    logger.error('getUsers', { error: error.message });
  }
};

export const userIdValidations = () => [param('id').notEmpty()];

type GetUserRequest = Request<{ id: string }>;

export const getUser = async (req: GetUserRequest, res: Response) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id).select('-password').lean();
    if (!user) {
      res.status(404).json({ message: USER_NOT_FOUND });
      return;
    }
    res.json(user);
    logger.debug(`getUser: ${user.email}`);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    logger.error(`getUser: ${id}`, { error: error.message });
  }
};

type DeleteUserRequest = Request<{ id: string }>;

export const deleteUser = async (req: DeleteUserRequest, res: Response) => {
  const { id } = req.params;
  try {
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      res.status(404).json({ message: USER_NOT_FOUND });
      return;
    }
    res.json(user);
    logger.debug(`deleteUser: ${user.email}`);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    logger.error(`deleteUser: ${id}`, { error: error.message });
  }
};

export const createRegistrationToken = (email: string, lang: string) => {
  assert(process.env.JWT_SECRET);

  return jwt.sign({ email, lang }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

export const inviteNewUserValidations = () => [
  param('email').isEmail(),
  param('lang').isIn(['en', 'nl']),
];

type InviteNewUserRequest = Request<{ email: string; lang: string }>;

export const inviteNewUser = async (
  req: InviteNewUserRequest,
  res: Response
) => {
  const { email, lang } = req.params;

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(400).json({ message: EMAIL_EXISTS });
    return;
  }

  const token = createRegistrationToken(email, lang);

  const template = lang === 'nl' ? 'register.nl.html' : 'register.en.html';

  let info: any;

  try {
    assert(process.env.SITE_NAME);
    assert(process.env.HOST_URL);
    assert(process.env.SMTP_USER);

    const custodianNameSetting = await Settings.findOne({
      name: 'custodian_name',
    }).lean();

    const html = await loadAsset(template, {
      email: email,
      site_name: process.env.SITE_NAME,
      activation_url: `${process.env.HOST_URL}/auth/register?email=${email}&lang=${lang}&token=${token}`,
      expiration_days: '7',
      custodian_name: custodianNameSetting?.stringVal ?? 'The Custodian',
    });

    info = await emailTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Registratie Code',
      html: html,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    logger.error('inviteNewUser', { email, error: error.message });
    return;
  }

  logger.debug(`inviteNewUser: ${info.messageId}`, { email });
  res.json(info);
};

export const validateRegTokenValidations = () => [
  query('email').isEmail(),
  query('token').isJWT(),
];

type ValidateRegTokenRequest = Request<
  never,
  never,
  never,
  { email: string; token: string }
>;

export const validateRegToken = async (
  req: ValidateRegTokenRequest,
  res: Response
) => {
  const { email, token } = req.query;
  let decoded: JwtPayload;

  assert(process.env.JWT_SECRET);

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
  } catch (error: any) {
    logger.error('validateRegToken', {
      email,
      error: (error as Error).message,
    });
    return res.status(400).json({ message: TOKEN_INVALID });
  }

  if (decoded.email !== email) {
    logger.error('registration', { email, error: EMAIL_MISMATCH });
    return res.status(400).json({ message: EMAIL_MISMATCH });
  }

  res.json({ message: OK });
};

export const getSettings = async (req: Request, res: Response) => {
  try {
    const settings = await Settings.find({}).sort({ sortOrder: 1 }).lean();
    res.status(200).json(settings);
    logger.debug(`getSettings: ${settings.length}`);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    logger.error('getSettings', { error: error.message });
  }
};

export const updateSettingsValidations = () => [
  body('settings').isArray().notEmpty(),
];

type UpdateSettingsRequest = Request<never, never, { settings: ISetting[] }>;

export const updateSettings = async (
  req: UpdateSettingsRequest,
  res: Response
) => {
  const { settings } = req.body;

  const updatePromises = settings.map((setting) => {
    let value: any;
    switch (setting.valueType) {
      case 'boolean':
        value = setting.booleanVal;
        break;
      case 'date':
        value = setting.dateVal;
        break;
      case 'number':
        value = setting.numberVal;
        break;
      case 'string':
        value = setting.stringVal;
        break;
      default:
        throw new Error(`invalid valueType: ${setting.valueType}`);
    }

    const update = { [`${setting.valueType}Val`]: value };
    const options = { upsert: true, new: true };
    return Settings.findByIdAndUpdate(setting._id, update, options);
  });

  try {
    await Promise.all(updatePromises);
    logger.debug('updateSettings success');
  } catch (err: any) {
    logger.error('updateSettings', { error: err.message });
    res.status(500).json({ message: err.message });
    return;
  }

  res.json({ message: 'settings saved' });
};
