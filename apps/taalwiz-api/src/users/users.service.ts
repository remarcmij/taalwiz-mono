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
import { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { EnvDto } from '../util/env.dto.js';
import User, { UserDoc } from './models/user.model.js';

const env = EnvDto.getInstance();

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

  async generateRefreshToken(user: UserDoc): Promise<{ token: string; exp: number }> {
    const payload: JwtPayload = {
      sub: user._id!.toString(),
      email: user.email,
      roles: user.roles,
    };

    const expirationDate = new Date(Date.now() + REFRESH_TOKEN_EXPIRATION * 1000);

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: REFRESH_TOKEN_EXPIRATION,
      secret: env.jwtRefreshSecret,
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
    return await User.find().exec();
  }

  async deleteUserById(id: string): Promise<UserDoc | null> {
    return await User.findByIdAndDelete(id).exec();
  }

  async inviteNewUser(email: string, lang: string): Promise<UserDoc> {
    const existing = await User.findOne({ email });
    if (existing) {
      throw new ForbiddenException('EMAIL_EXISTS');
    }

    const token = this.jwtService.sign(
      { email, lang },
      {
        secret: env.jwtSecret,
        expiresIn: '7d',
      },
    );

    const template = lang === 'nl' ? 'register.nl.hbs' : 'register.en.hbs';

    return await this.mailerService.sendMail({
      from: env.smtpUser,
      to: email,
      subject: lang == 'nl' ? 'Registratie Code' : 'Registration Code',
      template,
      context: {
        email,
        site_name: env.siteName,
        activation_url: `${env.hostUrl}/auth/register?email=${email}&lang=${lang}&token=${token}`,
        expiration_days: '7',
        custodian_name: env.custodianName,
      },
    });
  }

  async registerNewUser(email: string, password: string, name: string, token: string) {
    let decoded: JwtPayload;

    try {
      decoded = this.jwtService.verify(token, { secret: env.jwtSecret });
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

    const { token: refreshToken, exp } = await this.generateRefreshToken(user.toObject<UserDoc>());

    await this.mailerService.sendMail({
      from: env.smtpUser,
      to: env.custodianEmail,
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

    const payload: JwtPayload = { sub: user._id.toString(), email: user.email };
    const resetToken = this.jwtService.sign(payload, {
      secret: env.jwtSecret,
      expiresIn: '1h',
    });

    const resetLink = `${env.hostUrl}/auth/reset-password?email=${email}&token=${resetToken}`;

    // Send reset email
    await this.mailerService.sendMail({
      from: env.smtpUser,
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
    const decoded: JwtPayload = this.jwtService.verify(token, { secret: env.jwtSecret });

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
    return await this.mailerService.sendMail({
      from: env.smtpUser,
      to: env.custodianEmail,
      subject: 'Contact Form Submission',
      template: 'contact',
      context: {
        email,
        message,
      },
    });
  }
}
