import { MailerService } from '@nestjs-modules/mailer';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import assert from 'node:assert';
import { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import User, { IUser } from './models/user.model.js';

const REFRESH_TOKEN_EXPIRATION = 60 * 60 * 24 * 365; // 1 year
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
  ) {}

  async encryptPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async generateRefreshToken(user: IUser): Promise<{ token: string; exp: number }> {
    const payload: JwtPayload = {
      sub: user._id!.toString(),
      email: user.email,
      roles: user.roles,
    };

    const expirationDate = new Date(Date.now() + REFRESH_TOKEN_EXPIRATION * 1000);

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: REFRESH_TOKEN_EXPIRATION,
      secret: process.env.JWT_REFRESH_SECRET,
    });

    return { token, exp: expirationDate.getTime() };
  }

  async findOne(email: string): Promise<IUser | null> {
    return await User.findOne({ email }).exec();
  }

  async findById(id: string): Promise<IUser | null> {
    return await User.findById(id).exec();
  }

  async updateLastAccessed(id: string): Promise<IUser | null> {
    return await User.findByIdAndUpdate(id, { lastAccessed: new Date() }).exec();
  }

  async createUser(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return await user.save();
  }

  async getUsers(): Promise<IUser[]> {
    return await User.find().exec();
  }

  async deleteUserById(id: string): Promise<IUser | null> {
    return await User.findByIdAndDelete(id).exec();
  }

  async inviteNewUser(email: string, lang: string): Promise<IUser> {
    const existing = await User.findOne({ email });
    if (existing) {
      throw new ForbiddenException('EMAIL_EXISTS');
    }

    const token = this.jwtService.sign(
      { email, lang },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: '7d',
      },
    );

    const template = lang === 'nl' ? 'register.nl.hbs' : 'register.en.hbs';

    assert(process.env.SITE_NAME);
    assert(process.env.HOST_URL);
    assert(process.env.SMTP_USER);

    return await this.mailerService.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: lang == 'nl' ? 'Registratie Code' : 'Registration Code',
      template,
      context: {
        email,
        site_name: process.env.SITE_NAME,
        activation_url: `${process.env.HOST_URL}/auth/register?email=${email}&lang=${lang}&token=${token}`,
        expiration_days: '7',
        custodian_name: /*custodianNameSetting?.stringVal ??*/ 'The Custodian',
      },
    });
  }

  async registerNewUser(email: string, password: string, name: string, token: string) {
    let decoded: JwtPayload;

    assert(process.env.JWT_SECRET);

    try {
      decoded = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
    } catch (_) {
      this.logger.error('Invalid registration token');
      throw new ForbiddenException('TOKEN_INVALID');
    }

    if (decoded.email !== email) {
      this.logger.error('Email mismatch during registration');
      throw new ForbiddenException('EMAIL_MISMATCH');
    }

    let user = await User.findOne({ email }).exec();
    if (user) {
      this.logger.error('Email already exists during registration');
      throw new ForbiddenException('EMAIL_EXISTS');
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

    const { token: refreshToken, exp } = await this.generateRefreshToken(user.toObject<IUser>());

    await this.mailerService.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.CUSTODIAN_EMAIL,
      subject: 'New User Registration',
      template: 'user-registered',
      context: {
        email: user.email,
        name: user.name,
      },
    });

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      lang: user.lang,
      refreshToken,
      refreshExp: exp,
    };
  }

  async requestPasswordReset(email: string) {
    const user = await User.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException('EMAIL_NOT_FOUND');
    }

    if (user.roles.includes('demo')) {
      throw new ForbiddenException('DEMO_ACCOUNT');
    }

    assert(process.env.HOST_URL);
    assert(process.env.SMTP_USER);
    assert(process.env.JWT_SECRET);

    const payload = { sub: user._id, email: user.email };
    const resetToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '1h',
    });

    const resetLink = `${process.env.HOST_URL}/auth/reset-password?email=${email}&token=${resetToken}`;

    // Send reset email
    await this.mailerService.sendMail({
      from: process.env.SMTP_USER,
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
      throw new NotFoundException('EMAIL_NOT_FOUND');
    }

    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('AUTH_FAILED');
    }

    if (user.roles.includes('demo')) {
      throw new ForbiddenException('DEMO_ACCOUNT');
    }

    // Update the password
    const hashedNewPassword = await this.encryptPassword(newPassword);
    user.password = hashedNewPassword;
    await user.save();
  }

  async resetPassword(newPassword: string, token: string) {
    assert(process.env.JWT_SECRET);

    const decoded: JwtPayload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });

    const user = await User.findById(decoded.sub).exec();
    if (!user) {
      throw new NotFoundException('EMAIL_NOT_FOUND');
    }

    if (user.email !== decoded.email) {
      throw new ForbiddenException('EMAIL_MISMATCH');
    }

    if (user.roles.includes('demo')) {
      throw new ForbiddenException('DEMO_ACCOUNT');
    }

    const hashedPassword = await this.encryptPassword(newPassword);
    user.password = hashedPassword;
    await user.save();
  }

  async contactRequest(email: string, message: string) {
    assert(process.env.SMTP_USER);
    assert(process.env.CUSTODIAN_EMAIL);

    return await this.mailerService.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.CUSTODIAN_EMAIL,
      subject: 'Contact Form Submission',
      template: 'contact',
      context: {
        email,
        message,
      },
    });
  }
}
