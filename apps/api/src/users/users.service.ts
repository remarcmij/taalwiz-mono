import { MailerService } from '@nestjs-modules/mailer';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AUTH_FAILED,
  DEMO_ACCOUNT,
  EMAIL_EXISTS,
  EMAIL_MISMATCH,
  EMAIL_NOT_FOUND,
  TOKEN_EXPIRED,
  TOKEN_INVALID,
} from '@repo/api-types';
import bcrypt from 'bcrypt';
import type { AuthResponse } from '../auth/types/auth-response.interface.js';
import { JwtPayload, JwtPayloadSchema } from '../auth/types/jwtpayload.interface.js';
import { EnvDto } from '../util/env.dto.js';
import User, { Language, Role, UserDoc } from './models/user.model.js';

const REFRESH_TOKEN_EXPIRATION = 60 * 60 * 24 * 365; // 1 year

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly config: ConfigService<EnvDto, true>,
  ) {}

  async encryptPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async generateRefreshToken(user: UserDoc): Promise<{ token: string; exp: number }> {
    const payload: JwtPayload = {
      sub: user._id!.toString(),
      email: user.email,
      roles: user.roles,
      groups: user.groups as string[],
    };

    const expirationDate = new Date(Date.now() + REFRESH_TOKEN_EXPIRATION * 1000);

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: REFRESH_TOKEN_EXPIRATION,
      secret: this.config.get('JWT_REFRESH_SECRET'),
    });

    return { token, exp: expirationDate.getTime() };
  }

  async findOne(email: string): Promise<UserDoc | null> {
    return await User.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDoc | null> {
    return await User.findById(id).exec();
  }

  async updateLastAccessed(id: string): Promise<UserDoc | null> {
    return await User.findByIdAndUpdate(id, { lastAccessed: new Date() }).exec();
  }

  async createUser(userData: Partial<UserDoc>): Promise<UserDoc> {
    const user = new User(userData);
    return await user.save();
  }

  async getUsers(): Promise<UserDoc[]> {
    return await User.find().lean().exec();
  }

  async deleteUserById(id: string): Promise<UserDoc | null> {
    return await User.findByIdAndDelete(id).exec();
  }

  async updateUserGroups(id: string, groups: string[]): Promise<UserDoc | null> {
    return await User.findByIdAndUpdate(id, { groups }, { new: true }).exec();
  }

  async inviteNewUser(email: string, lang: string): Promise<UserDoc> {
    const existing = await User.findOne({ email });
    if (existing) {
      throw new ForbiddenException(EMAIL_EXISTS);
    }

    const token = this.jwtService.sign(
      { email, lang },
      {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: '7d',
      },
    );

    const template = lang === 'nl' ? 'register.nl.hbs' : 'register.en.hbs';

    return await this.mailerService.sendMail({
      from: this.config.get('SMTP_USER'),
      to: email,
      subject: lang == 'nl' ? 'Registratie Code' : 'Registration Code',
      template,
      context: {
        email,
        site_name: this.config.get('SITE_NAME'),
        activation_url: `${this.config.get('HOST_URL')}/auth/register?email=${email}&lang=${lang}&token=${token}`,
        expiration_days: '7',
        custodian_name: this.config.get('CUSTODIAN_NAME'),
      },
    });
  }

  async registerNewUser(
    email: string,
    password: string,
    name: string,
    token: string,
  ): Promise<AuthResponse> {
    let decoded: JwtPayload;

    try {
      decoded = JwtPayloadSchema.parse(
        this.jwtService.verify(token, { secret: this.config.get('JWT_SECRET') }),
      );
    } catch (_) {
      this.logger.error('Invalid registration token');
      throw new ForbiddenException(TOKEN_INVALID);
    }

    if (decoded.email !== email) {
      this.logger.error('Email mismatch during registration');
      throw new ForbiddenException(EMAIL_MISMATCH);
    }

    let user = await User.findOne({ email }).exec();
    if (user) {
      this.logger.error('Email already exists during registration');
      throw new ForbiddenException(EMAIL_EXISTS);
    }

    const hashedPassword = await this.encryptPassword(password);

    user = new User({
      email,
      password: hashedPassword,
      name,
      lang: decoded?.lang ?? 'nl',
      roles: ['user'],
    });
    await user.save();

    const { token: refreshToken, exp } = await this.generateRefreshToken(user.toObject<UserDoc>());

    await this.mailerService.sendMail({
      from: this.config.get('SMTP_USER'),
      to: this.config.get('CUSTODIAN_EMAIL'),
      subject: 'New User Registration',
      template: 'user-registered',
      context: {
        email: user.email,
        name: user.name,
      },
    });

    return {
      id: user._id!.toString(),
      email: user.email,
      name: user.name,
      roles: user.roles as Role[],
      groups: user.groups as string[],
      lang: user.lang as Language,
      refreshToken,
      refreshExp: exp,
    };
  }

  async requestPasswordReset(email: string) {
    const user = await User.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException(EMAIL_NOT_FOUND);
    }

    if (user.roles.includes('demo')) {
      throw new ForbiddenException(DEMO_ACCOUNT);
    }

    const payload: JwtPayload = { sub: user._id.toString(), email: user.email };
    const resetToken = this.jwtService.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: '1h',
    });

    const resetLink = `${this.config.get('HOST_URL')}/auth/reset-password?email=${email}&token=${resetToken}`;

    // Send reset email
    await this.mailerService.sendMail({
      from: this.config.get('SMTP_USER'),
      to: user.email,
      subject: 'Password Reset',
      template: 'reset-password-request',
      context: {
        resetLink,
      },
    });
  }

  async changePassword(email: string, password: string, newPassword: string) {
    const user = await User.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException(EMAIL_NOT_FOUND);
    }

    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(AUTH_FAILED);
    }

    if (user.roles.includes('demo')) {
      throw new ForbiddenException(DEMO_ACCOUNT);
    }

    // Update the password
    const hashedNewPassword = await this.encryptPassword(newPassword);
    user.password = hashedNewPassword;
    await user.save();
  }

  async resetPassword(newPassword: string, token: string) {
    let decoded: JwtPayload;

    try {
      decoded = JwtPayloadSchema.parse(
        this.jwtService.verify(token, { secret: this.config.get('JWT_SECRET') }),
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        this.logger.error('Password reset token expired');
        throw new ForbiddenException(TOKEN_EXPIRED);
      }
      this.logger.error('Invalid password reset token');
      throw new ForbiddenException(TOKEN_INVALID);
    }

    const user = await User.findById(decoded.sub).exec();
    if (!user) {
      throw new NotFoundException(EMAIL_NOT_FOUND);
    }

    if (user.email !== decoded.email) {
      throw new ForbiddenException(EMAIL_MISMATCH);
    }

    if (user.roles.includes('demo')) {
      throw new ForbiddenException(DEMO_ACCOUNT);
    }

    const hashedPassword = await this.encryptPassword(newPassword);
    user.password = hashedPassword;
    await user.save();
  }

  async contactRequest(email: string, message: string) {
    return await this.mailerService.sendMail({
      from: this.config.get('SMTP_USER'),
      to: this.config.get('CUSTODIAN_EMAIL'),
      subject: 'Contact Form Submission',
      template: 'contact',
      context: {
        email,
        message,
      },
    });
  }
}
