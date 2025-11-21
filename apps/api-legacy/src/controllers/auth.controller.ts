import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import { body } from 'express-validator';
import jwt, { JwtPayload } from 'jsonwebtoken';
import assert from 'node:assert/strict';

import Settings from '../models/settings.model.js';
import User, { IUser } from '../models/user.model.js';
import {
  AUTH_FAILED,
  EMAIL_EXISTS,
  EMAIL_MISMATCH,
  MIN_PASSWORD_LENGTH,
  TOKEN_INVALID,
} from '../shared/shared.js';
import { loadAsset } from '../util/assetsLoader.js';
import emailTransporter from '../util/email-transporter.js';
import logger from '../util/logger.js';

const ACCESS_TOKEN_EXPIRATION = 60 * 60; // 1 hour
const REFRESH_TOKEN_EXPIRATION = 60 * 60 * 24 * 365; // 1 year

function generateToken(data: any, expSeconds: number) {
  assert(process.env.JWT_SECRET);
  const exp = Math.floor(Date.now() / 1000) + expSeconds;
  const token = jwt.sign({ exp, ...data }, process.env.JWT_SECRET);
  return { token, exp };
}

export function generateAccessToken(user: IUser) {
  return generateToken(
    { id: user._id, email: user.email, role: user.role },
    ACCESS_TOKEN_EXPIRATION
  );
}

export function generateRefreshToken(user: IUser) {
  return generateToken(
    { id: user._id, email: user.email },
    REFRESH_TOKEN_EXPIRATION
  );
}

export const encryptPassword = (password: string) => bcrypt.hash(password, 10);

export const registerValidations = () => [
  body('email').isEmail(),
  body('password').isLength({ min: MIN_PASSWORD_LENGTH }),
  body('name').notEmpty(),
  body('token').isJWT(),
];

type RegisterRequest = Request<
  never,
  never,
  { email: string; password: string; name: string; token: string }
>;

export const register = async (req: RegisterRequest, res: Response) => {
  const { email, password, name, token } = req.body;
  let decoded: JwtPayload | undefined;

  assert(process.env.JWT_SECRET);

  try {
    decoded = jwt.verify(token!, process.env.JWT_SECRET) as JwtPayload;
  } catch (error: any) {
    logger.error('validateRegToken', { email, error: error.message });
    return res.status(400).json({ message: TOKEN_INVALID });
  }

  if (decoded.email !== email) {
    logger.error('registration', { email, error: EMAIL_MISMATCH });
    return res.status(400).json({ message: EMAIL_MISMATCH });
  }

  let user = await User.findOne({ email }).exec();
  if (user) {
    logger.error('registration', { email, error: EMAIL_EXISTS });
    return res.status(400).json({ message: EMAIL_EXISTS });
  }

  const hashedPassword = await encryptPassword(password);

  user = new User({
    email,
    password: hashedPassword,
    name,
    lang: decoded?.lang ?? 'en',
    role: 'user',
  });
  await user.save();

  const { token: refreshToken, exp } = generateRefreshToken(
    user.toObject<IUser>()
  );

  try {
    if (process.env.NODE_ENV !== 'test') {
      const emailOptOutSetting = await Settings.findOne({
        name: 'email_opt_out',
      }).lean();

      const customerServiceEmailSetting = await Settings.findOne({
        name: 'customer_service_email',
      }).lean();

      if (!emailOptOutSetting?.booleanVal && customerServiceEmailSetting) {
        const html = await loadAsset('user-registered.html', {
          email: user.email,
          name: user.name,
        });

        assert(process.env.SMTP_USER);
        await emailTransporter.sendMail({
          from: process.env.SMTP_USER,
          to: customerServiceEmailSetting.stringVal,
          subject: 'New User Registration',
          html,
        });
      }
    }

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      lang: user.lang,
      refreshToken,
      refreshExp: exp,
    });

    logger.debug('user register successfully', {
      email: user.email,
      name: user.name,
    });
  } catch (error: any) {
    logger.error('user register failed', {
      email: user.email,
      name: user.name,
      error: error.message,
    });
    res.status(500).json({ message: error.message });
  }
};

export const loginValidations = () => [
  body('email').isEmail(),
  body('password').isLength({ min: MIN_PASSWORD_LENGTH }),
];

type LoginRequest = Request<never, never, { email: string; password: string }>;

export const login = async (req: LoginRequest, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).exec();

    if (!user) {
      logger.error('login', { email, error: AUTH_FAILED });
      return res.status(401).json({ message: AUTH_FAILED });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      logger.error('login', { email, error: AUTH_FAILED });
      return res.status(401).json({ message: AUTH_FAILED });
    }

    const { token, exp } = generateRefreshToken(user.toObject<IUser>());

    res.json({
      id: user._id,
      email: user.email,
      name: user.name,
      lang: user.lang,
      role: user.role,
      refreshToken: token,
      refreshExp: exp,
    });

    logger.debug('login', { email: user.email });
  } catch (error: any) {
    logger.error('login', { email, error: error.message });
    res.status(500).json({ message: error.message });
  }
};

export const changePasswordValidations = () => [
  body('email').isEmail(),
  body('password').isLength({ min: MIN_PASSWORD_LENGTH }),
  body('newPassword').isLength({ min: MIN_PASSWORD_LENGTH }),
];

type ChangePasswordRequest = Request<
  never,
  never,
  { email: string; password: string; newPassword: string }
>;

export const changePassword = async (
  req: ChangePasswordRequest,
  res: Response
) => {
  const { email, password, newPassword } = req.body;
  try {
    const user = await User.findOne({ email }).exec();
    if (!user) {
      return res.status(400).json({ message: AUTH_FAILED });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: AUTH_FAILED });
    }

    if (user.role === 'demo') {
      return res.status(403).json({ message: 'DEMO_ACCOUNT' });
    }

    // Update the password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    logger.error(error.message);
    res.status(500).json({ message: error.message });
  }
};

export const requestPasswordResetValidations = () => [body('email').isEmail()];

type RequestPasswordResetRequest = Request<never, never, { email: string }>;

export const requestPasswordReset = async (
  req: RequestPasswordResetRequest,
  res: Response
) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email }).exec();
    if (!user) {
      return res.status(404).json({ message: 'EMAIL_NOT_FOUND' });
    }

    if (user.role === 'demo') {
      return res.status(403).json({ message: 'DEMO_ACCOUNT' });
    }

    assert(process.env.HOST_URL);
    assert(process.env.SMTP_USER);
    assert(process.env.JWT_SECRET);

    const resetToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const resetLink = `${process.env.HOST_URL}/auth/reset-password?email=${email}&token=${resetToken}`;

    // Send reset email
    await emailTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: user.email,
      subject: 'Password Reset',
      text: `Click the link to reset your password: ${resetLink}`,
    });

    res.json({ message: 'PASSWORD_RESET_EMAIL_SENT' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const resetPasswordValidations = () => [
  body('token').isJWT(),
  body('newPassword').isLength({ min: MIN_PASSWORD_LENGTH }),
];

type ResetPasswordRequest = Request<
  never,
  never,
  { token: string; newPassword: string }
>;

export const resetPassword = async (
  req: ResetPasswordRequest,
  res: Response
) => {
  const { token, newPassword } = req.body;

  assert(process.env.JWT_SECRET);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      id: number;
      email: string;
    };
    const user = await User.findById(decoded.id).exec();
    if (!user) {
      return res.status(404).json({ message: 'EMAIL_NOT_FOUND' });
    }

    if (user.email !== decoded.email) {
      return res.status(403).json({ message: 'EMAIL_MISMATCH' });
    }

    if (user.role === 'demo') {
      return res.status(403).json({ message: 'DEMO_ACCOUNT' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'OK' });
  } catch (error) {
    console.error(error);
    res.status(403).json({ message: 'TOKEN_INVALID' });
  }
};

export const contactValidations = () => [
  body('message').notEmpty(),
  body('email').isEmail(),
];

type ContactRequest = Request<never, never, { message: string; email: string }>;

export const contact = (req: ContactRequest, resp: Response) => {
  const { message, email } = req.body;
  assert(process.env.SMTP_USER);
  assert(process.env.CUSTOMER_SERVICE_EMAIL);

  emailTransporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.CUSTOMER_SERVICE_EMAIL,
    subject: 'Contact Form Submission',
    text: `From: ${email}\n\n${message}`,
  });

  resp.json({ message: 'OK' });
};

export const refreshAccessTokenValidations = () => [
  body('refreshToken').notEmpty(),
];

type RefreshAccessTokenRequest = Request<
  never,
  never,
  { refreshToken: string }
>;

export const refreshAccessToken = async (
  req: RefreshAccessTokenRequest,
  res: Response
) => {
  assert(process.env.JWT_SECRET);

  const { refreshToken } = req.body;

  let decoded: JwtPayload;

  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_SECRET) as JwtPayload;
    const user = await User.findById(decoded.id).exec();
    if (!user) {
      throw new Error('invalid refresh token');
    }
    user.lastAccessed = new Date();
    user.save();

    const { token, exp } = generateAccessToken(user.toObject<IUser>());
    res.json({ token, exp });
    logger.debug('refreshAccessToken', { email: user.email });
  } catch (error: any) {
    logger.error('refreshAccessToken', {
      error: error.message,
    });
    res.status(403).json({ message: error.message });
  }
};
